import { openDatabase } from "../src/database.js";
const db = openDatabase();
console.info(
  "Migrations applied:",
  db.prepare("SELECT name FROM schema_migrations ORDER BY name").all(),
);
db.close();
