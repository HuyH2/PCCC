import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { openDatabase } from "../../pccc-BE/src/core/database.js";
import { seedDemo } from "../../pccc-BE/src/core/seed.js";
import { createApp } from "../../pccc-BE/src/app.js";

if (process.env.PCCC_TEST_DATABASE_URL) throw new Error("QA requires PGlite in memory");
const db = await openDatabase(":memory:");
const password = randomBytes(18).toString("hex");
await seedDemo(db, password);
await db.exec("UPDATE accounts SET must_change_password=0");
for (const [role, actions] of [
  ["A01", ["view", "create", "edit", "approve"]],
  ["A03", ["view", "create", "edit"]],
])
  for (const action of actions)
    await db
      .prepare("INSERT INTO role_permissions VALUES (?,?) ON CONFLICT DO NOTHING")
      .run(role, `M04.${action}`);
const backend = createApp(db, { appOrigin: "http://127.0.0.1:3217" });
backend.listen(4217, "127.0.0.1");
await once(backend, "listening");
const requireFE = createRequire(new URL("../../pccc-FE/package.json", import.meta.url));
const frontend = spawn(
  process.execPath,
  [requireFE.resolve("next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", "3217"],
  {
    cwd: fileURLToPath(new URL("../../pccc-FE/", import.meta.url)),
    env: {
      ...process.env,
      BACKEND_URL: "http://127.0.0.1:4217",
      NEXT_TEST_DIST_DIR: ".next-doc-vio",
    },
    stdio: ["ignore", "inherit", "inherit"],
    windowsHide: true,
  },
);
// Ephemeral local-only fixture credential; never write to evidence or commit it.
console.log(`QA_LOGIN demo.chi-huy / ${password}`);
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  if (frontend.exitCode === null) {
    const ended = once(frontend, "exit");
    frontend.kill();
    await ended;
  }
  await new Promise((resolve) => backend.close(resolve));
  await db.close();
  process.exit();
}
process.on("SIGINT", close);
process.on("SIGTERM", close);
process.stdin.resume();
process.stdin.on("data", close);
frontend.on("exit", () => {
  if (!closing) void close();
});
