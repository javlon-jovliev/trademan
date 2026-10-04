// Private Mac runtime. Start with node --env-file=.env.live scripts/local-live.mjs.
import { spawn } from "node:child_process";
import {
  readFileSync,
  mkdirSync,
  openSync,
  closeSync,
  unlinkSync,
} from "node:fs";
import { resolve } from "node:path";
import https from "node:https";
import http from "node:http";
import { PrismaClient } from "@prisma/client";

process.umask(0o077);
const origin = new URL(process.env.APP_ORIGIN ?? "https://localhost:3443");
const database = new URL(process.env.DATABASE_URL ?? "");
if (
  process.env.DEMO_MODE !== "false" ||
  origin.protocol !== "https:" ||
  origin.hostname !== "localhost" ||
  database.hostname !== "127.0.0.1" ||
  database.pathname !== "/erta_live"
) {
  throw Error(
    "Use the private .env.live with HTTPS localhost and isolated erta_live database",
  );
}
const cert = readFileSync(process.env.LOCAL_TLS_CERT);
const key = readFileSync(process.env.LOCAL_TLS_KEY);
const children = [];
let stopping = false;
let proxy;
let prisma;
mkdirSync("data/live-logs", { recursive: true, mode: 0o700 });
const lock = resolve("data/local-live.lock");
try {
  const previous = Number(readFileSync(lock, "utf8"));
  try {
    process.kill(previous, 0);
    throw Error("ERTA live is already running");
  } catch (error) {
    if (error.code !== "ESRCH") throw error;
  }
  unlinkSync(lock);
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const lockFd = openSync(lock, "wx", 0o600);
await import("node:fs/promises").then(({ writeFile }) =>
  writeFile(lock, String(process.pid)),
);
closeSync(lockFd);

function launch(name, command, args, cwd = process.cwd()) {
  const log = openSync(resolve(`data/live-logs/${name}.log`), "a", 0o600);
  const child = spawn(command, args, {
    cwd,
    env: process.env,
    stdio: ["ignore", log, log],
  });
  closeSync(log);
  children.push(child);
  child.on("error", () => {
    console.error(`${name} failed to start; see its private log`);
    void stop(1);
  });
  child.on("exit", () => {
    if (!stopping) {
      console.error(`${name} stopped; see its private log`);
      void stop(1);
    }
  });
  return child;
}
async function run(command, args) {
  const child = launch("setup", command, args);
  // Setup commands are expected to exit successfully.
  child.removeAllListeners("exit");
  await new Promise((ok, fail) => {
    child.once("exit", (code) =>
      code === 0
        ? ok()
        : fail(Error("Database setup failed; see private setup.log")),
    );
    child.once("error", fail);
  });
}
async function until(check, description) {
  const deadline = Date.now() + 90000;
  while (!stopping && Date.now() < deadline) {
    try {
      if (await check()) return;
    } catch {
      /* Startup is still in progress. */
    }
    await new Promise((ok) => setTimeout(ok, 1000));
  }
  throw Error(`${description} did not become ready; see data/live-logs`);
}
async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  proxy?.close();
  for (const child of children.toReversed())
    if (child.exitCode === null) child.kill("SIGTERM");
  await prisma?.$disconnect().catch(() => {});
  await Promise.race([
    Promise.all(
      children
        .filter((child) => child.exitCode === null)
        .map((child) => new Promise((ok) => child.once("exit", ok))),
    ),
    new Promise((ok) => setTimeout(ok, 10000)),
  ]);
  for (const child of children)
    if (child.exitCode === null) child.kill("SIGKILL");
  try {
    unlinkSync(lock);
  } catch {
    /* Already removed. */
  }
  process.exit(code);
}
process.on("SIGINT", () => void stop());
process.on("SIGTERM", () => void stop());

try {
  prisma = new PrismaClient();
  launch("database", process.execPath, [
    "--import",
    "tsx",
    "scripts/local-db.ts",
  ]);
  await until(async () => {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  }, "PostgreSQL");
  await run(process.execPath, [
    "node_modules/prisma/build/index.js",
    "migrate",
    "deploy",
  ]);
  await run(process.execPath, ["--import", "tsx", "prisma/seed.ts"]);

  // A Gateway already started for browser login can be reused; no auth/order changes.
  const gatewayUrl = new URL(process.env.IBKR_GATEWAY_URL);
  try {
    await fetch(gatewayUrl, { signal: AbortSignal.timeout(3000) });
  } catch {
    const gatewayDir = process.env.LOCAL_GATEWAY_DIR;
    launch(
      "gateway",
      process.env.LOCAL_JAVA,
      [
        "-server",
        "-Dvertx.disableDnsResolver=true",
        "-Djava.net.preferIPv4Stack=true",
        "-cp",
        "root:dist/ibgroup.web.core.iblink.router.clientportal.gw.jar:build/lib/runtime/*",
        "ibgroup.web.core.clientportal.gw.GatewayStart",
        "--conf",
        "../root/conf.yaml",
      ],
      gatewayDir,
    );
    await until(async () => {
      await fetch(gatewayUrl, { signal: AbortSignal.timeout(2000) });
      return true;
    }, "IBKR Gateway");
  }
  await run(process.execPath, ["--import", "tsx", "scripts/connect-live.ts"]);
  launch("web", process.execPath, [
    "node_modules/next/dist/bin/next",
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3001",
  ]);
  await until(
    async () => (await fetch("http://127.0.0.1:3001/login")).ok,
    "ERTA web",
  );
  proxy = https.createServer({ key, cert }, (request, response) => {
    if (request.headers.host !== origin.host) {
      response.writeHead(421);
      response.end();
      return;
    }
    const upstream = http.request(
      {
        hostname: "127.0.0.1",
        port: 3001,
        method: request.method,
        path: request.url,
        headers: request.headers,
      },
      (result) => {
        response.writeHead(result.statusCode ?? 502, result.headers);
        result.pipe(response);
      },
    );
    upstream.on("error", () => {
      response.writeHead(502);
      response.end("ERTA temporarily unavailable");
    });
    request.on("aborted", () => upstream.destroy());
    request.pipe(upstream);
  });
  await new Promise((ok, fail) => {
    proxy.once("error", fail);
    proxy.listen(Number(origin.port || 443), "127.0.0.1", ok);
  });
  launch("worker", process.execPath, ["--import", "tsx", "scripts/worker.ts"]);
  console.log(
    `ERTA live: ${origin.origin}\nIBKR login: ${gatewayUrl.origin}\nKeep this window open. IBKR requires daily browser login. Ctrl+C stops services.`,
  );
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Local live startup failed",
  );
  await stop(1);
}
