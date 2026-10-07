import { openDatabase } from "../src/database.js";
import { seedDemo } from "../src/seed.js";
const db = openDatabase();
try {
  await seedDemo(db, process.env.DEMO_PASSWORD);
  console.info(
    "Demo roles and accounts seeded. Existing passwords and authorization were preserved.",
  );
} finally {
  db.close();
}
