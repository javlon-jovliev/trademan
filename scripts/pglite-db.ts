import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
const url = new URL(
  process.env.DATABASE_URL ??
    "postgresql://postgres:postgres@127.0.0.1:55432/postgres",
);
if (!["localhost", "127.0.0.1"].includes(url.hostname))
  throw Error("PGlite development server requires localhost");
async function main() {
  const db = await PGlite.create("data/pglite");
  const server = new PGLiteSocketServer({
    db,
    maxConnections: 20,
    host: "127.0.0.1",
    port: Number(url.port || 55432),
  });
  await server.start();
  console.log(`ERTA development PostgreSQL (PGlite) on 127.0.0.1:${url.port}`);
  for (const sig of ["SIGINT", "SIGTERM"] as const)
    process.on(sig, async () => {
      await server.stop();
      await db.close();
      process.exit();
    });
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
