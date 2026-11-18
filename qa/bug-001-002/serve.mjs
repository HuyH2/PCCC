import { once } from "node:events";
import { appendFileSync } from "node:fs";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { openDatabase } from "../../pccc-BE/src/core/database.js";
import { seedDemo } from "../../pccc-BE/src/core/seed.js";
import { createApp } from "../../pccc-BE/src/app.js";

if (!process.env.PCCC_TEST_DATABASE_URL?.startsWith("postgresql://"))
  throw new Error("Set PCCC_TEST_DATABASE_URL to a dedicated local PostgreSQL server.");
const db = await openDatabase(":memory:"); // Creates an isolated PostgreSQL server database.
await seedDemo(db, "Bug-regression-local-2026");
await db.exec("UPDATE accounts SET must_change_password=0");
for (const action of ["view", "create", "edit"])
  await db
    .prepare("INSERT INTO role_permissions VALUES ('A05',?) ON CONFLICT DO NOTHING")
    .run(`M02.${action}`);
const backend = createApp(db, { appOrigin: "http://127.0.0.1:3100" });
backend.on("request", (req, res) => {
  res.on("finish", () =>
    appendFileSync(
      new URL("./http.log", import.meta.url),
      `${req.method} ${req.url} ${res.statusCode}\n`,
    ),
  );
});
backend.listen(4000, "127.0.0.1");
await once(backend, "listening");
const requireFE = createRequire(new URL("../../pccc-FE/package.json", import.meta.url));
const frontend = spawn(
  process.execPath,
  [requireFE.resolve("next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", "3100"],
  {
    cwd: fileURLToPath(new URL("../../pccc-FE/", import.meta.url)),
    env: { ...process.env, BACKEND_URL: "http://127.0.0.1:4000" },
    stdio: ["ignore", "inherit", "inherit"],
    windowsHide: true,
  },
);
console.log("Local QA: http://127.0.0.1:3100 — demo.admin / Bug-regression-local-2026");
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  if (frontend.exitCode === null) {
    const ended = once(frontend, "exit");
    frontend.kill();
    await ended;
  }
  await new Promise((done) => backend.close(done));
  await db.close();
  process.exit();
}
process.on("SIGINT", close);
process.on("SIGTERM", close);
process.stdin.resume();
process.stdin.on("data", close);
