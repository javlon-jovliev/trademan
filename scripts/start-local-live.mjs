import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { parse } from "dotenv";

// NODE_EXTRA_CA_CERTS must exist before the new Node process starts.
const env = { ...process.env, ...parse(readFileSync(".env.live")) };
const child = spawn(process.execPath, ["scripts/local-live.mjs"], {
  env,
  stdio: "inherit",
});
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
child.on("error", () => {
  console.error("ERTA live could not start");
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
