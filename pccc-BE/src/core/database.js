import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const migrationDirectory = fileURLToPath(new URL("../../migrations/", import.meta.url));
const require = createRequire(import.meta.url);

export function transaction(db, work) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = work();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

/** Case- and accent-insensitive form for Vietnamese search ("Đông Á" -> "dong a"). */
export function foldSearchText(value) {
  if (value == null) return null;
  return String(value)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

export function openDatabase(path = process.env.DATABASE_PATH || "./data/pccc.sqlite") {
  if (path !== ":memory:") mkdirSync(dirname(resolve(path)), { recursive: true });
  const db = new DatabaseSync(path);
  db.function("fold", { deterministic: true }, foldSearchText);
  db.exec("PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;");
  db.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)",
  );
  for (const name of readdirSync(migrationDirectory)
    .filter((f) => f.endsWith(".sql") || f.endsWith(".cjs"))
    .sort()) {
    if (db.prepare("SELECT 1 FROM schema_migrations WHERE name=?").get(name)) continue;
    transaction(db, () => {
      const path = resolve(migrationDirectory, name);
      if (name.endsWith(".cjs")) require(path)(db);
      else db.exec(readFileSync(path, "utf8"));
      db.prepare("INSERT INTO schema_migrations VALUES (?,?)").run(name, Date.now());
    });
  }
  return db;
}
