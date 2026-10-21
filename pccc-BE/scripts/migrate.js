import { openDatabase } from "../src/core/database.js";
const db = await openDatabase();
console.info(
  "Migrations applied:",
  await db.prepare("SELECT name FROM schema_migrations ORDER BY name").all(),
);
await db.close();
