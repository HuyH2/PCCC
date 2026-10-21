import { spawn } from "node:child_process";
import { once } from "node:events";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { openDatabase } from "../pccc-BE/src/core/database.js";
import { createApp } from "../pccc-BE/src/app.js";
import { runDemoSeed } from "../pccc-BE/scripts/seed-incidents-demo.js";

// Explicit, persistent, synthetic browser verification fixture. No live database or .env is used.
const repository = fileURLToPath(new URL("../", import.meta.url));
const frontendRequire = createRequire(new URL("../pccc-FE/package.json", import.meta.url));
const nextBinary = frontendRequire.resolve("next/dist/bin/next");
const databasePath = resolve(
  repository,
  "pccc-BE/data/m09-browser-verification/incidents-demo.sqlite",
);
const uploadDirectory = resolve(
  repository,
  "pccc-BE/private/m09-browser-verification/incidents-demo-uploads",
);
const password = "M09-browser-demo-only";
const backendPort = Number(process.env.TEST_BACKEND_PORT || 4419);
const frontendPort = Number(process.env.TEST_FRONTEND_PORT || 3319);
const origin = `http://localhost:${frontendPort}`;

if (!process.argv.includes("--demo")) {
  throw new Error(
    "Run this isolated browser fixture with --demo. It preserves its marked synthetic database and uploads.",
  );
}

const seed = await runDemoSeed(
  ["--demo", "--database", databasePath, "--uploads", uploadDirectory],
  password,
);
if (
  seed.database.toLowerCase() !== databasePath.toLowerCase() ||
  seed.uploadsDirectory.toLowerCase() !== uploadDirectory.toLowerCase()
) {
  throw new Error("Browser fixture paths must resolve to their explicit verification directories.");
}
const db = openDatabase(databasePath);
// Only this marked synthetic database receives these test grants.
for (const action of ["view", "create", "edit", "approve", "export"])
  db.prepare("INSERT OR IGNORE INTO role_permissions VALUES (?,?)").run("A04", `M09.${action}`);

const backend = createApp(db, { appOrigin: origin, uploadDirectory });
let frontend;
let closing;
async function stop(code = 0) {
  if (closing) return closing;
  closing = (async () => {
    process.stdin.pause();
    if (frontend?.exitCode === null && frontend.signalCode === null) {
      const ended = once(frontend, "exit");
      frontend.kill();
      await ended;
    }
    if (backend.listening) await new Promise((done) => backend.close(done));
    db.close();
    console.info(
      JSON.stringify({
        fixture: "M09_BROWSER_DEMO",
        stopped: true,
        databasePath,
        uploadDirectory,
        artifactsPreserved: true,
      }),
    );
    process.exitCode = code;
  })();
  return closing;
}

process.on("SIGINT", () => {
  void stop();
});
process.on("SIGTERM", () => {
  void stop();
});
let stdin = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  stdin += chunk;
  const lines = stdin.split(/\r?\n/);
  stdin = lines.pop();
  if (lines.some((line) => line.trim().toLowerCase() === "stop")) void stop();
});

try {
  backend.listen(backendPort, "127.0.0.1");
  await once(backend, "listening");
  frontend = spawn(
    process.execPath,
    [nextBinary, "start", "--hostname", "127.0.0.1", "--port", String(frontendPort)],
    {
      cwd: fileURLToPath(new URL("../pccc-FE/", import.meta.url)),
      env: {
        ...process.env,
        BACKEND_URL: `http://127.0.0.1:${backendPort}`,
        NEXT_TEST_DIST_DIR: ".next-m09-tests",
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );
  frontend.stdout.on("data", (chunk) => process.stdout.write(chunk));
  frontend.stderr.on("data", (chunk) => process.stderr.write(chunk));
  frontend.on("error", (error) => {
    console.error(error.message);
    void stop(1);
  });
  frontend.on("exit", (code) => {
    if (!closing) void stop(code || 0);
  });
  let ready = false;
  for (let index = 0; index < 100 && !closing; index++) {
    if (frontend.exitCode !== null || frontend.signalCode !== null) break;
    try {
      if (
        (
          await fetch(`http://127.0.0.1:${frontendPort}/dang-nhap`, {
            signal: AbortSignal.timeout(1000),
          })
        ).status === 200
      ) {
        ready = true;
        break;
      }
    } catch {
      /* Next is starting from the isolated production test build. */
    }
    await new Promise((done) => setTimeout(done, 200));
  }
  if (!ready)
    throw new Error("Browser fixture frontend did not become ready. Build .next-m09-tests first.");
  console.info(
    JSON.stringify({
      fixture: "M09_BROWSER_DEMO",
      ready: true,
      frontendUrl: origin,
      backendUrl: `http://127.0.0.1:${backendPort}`,
      databasePath,
      uploadDirectory,
      username: "demo.tong-hop",
      demoPassword: password,
      m09TestGrants: ["view", "create", "edit", "approve", "export"],
      syntheticOnly: true,
      stopCommand: "stop",
      artifactsPreservedOnStop: true,
    }),
  );
} catch (error) {
  console.error(error.message);
  await stop(1);
}
