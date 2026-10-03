import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
const url = new URL(
  process.env.DATABASE_URL ??
    "postgresql://erta:local-only@localhost:55432/erta",
);
if (!["localhost", "127.0.0.1"].includes(url.hostname))
  throw Error("Local DB script requires localhost");
const databaseDir = resolve("data/postgres");
const pg = new EmbeddedPostgres({
  databaseDir,
  user: url.username,
  password: url.password,
  port: Number(url.port || 55432),
  persistent: true,
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
  authMethod: "scram-sha-256",
  postgresFlags: ["-h", "127.0.0.1"],
  onLog: console.log,
  onError: console.error,
});
async function start() {
  if (!existsSync(resolve(databaseDir, "PG_VERSION"))) await pg.initialise();
  await pg.start();
  const client = pg.getPgClient();
  await client.connect();
  const result = await client.query(
    "SELECT 1 FROM pg_database WHERE datname=$1",
    [url.pathname.slice(1)],
  );
  await client.end();
  if (!result.rowCount) await pg.createDatabase(url.pathname.slice(1));
  console.log(`ERTA local PostgreSQL running on 127.0.0.1:${url.port}`);
}
start().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
for (const sig of ["SIGTERM", "SIGINT"] as const)
  process.on(sig, async () => {
    await pg.stop();
    process.exit();
  });
