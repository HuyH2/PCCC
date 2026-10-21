import { openDatabase } from "../src/core/database.js";
import { seedDemo } from "../src/core/seed.js";
const db = await openDatabase();
try {
  await seedDemo(db, process.env.DEMO_PASSWORD);
  console.info(
    "Demo roles and accounts seeded. Existing passwords and authorization were preserved.",
  );
} finally {
  await db.close();
}
