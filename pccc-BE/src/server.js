import { openDatabase } from "./core/database.js";
import { createApp } from "./app.js";
import { principalFor } from "./modules/auth/auth.service.js";
import { refreshReportReminders } from "./modules/reports/reports.service.js";

const production = process.env.NODE_ENV === "production";
const appOrigin = process.env.APP_ORIGIN || "http://localhost:3000";
const secureCookie = process.env.COOKIE_SECURE === "true";
if (production && (!secureCookie || !appOrigin.startsWith("https://"))) {
  throw new Error("Production requires COOKIE_SECURE=true and an HTTPS APP_ORIGIN.");
}
const db = openDatabase();
const server = createApp(db, {
  appOrigin,
  secureCookie,
  ttlSeconds: Number(process.env.SESSION_TTL_SECONDS || 28800),
});
const port = Number(process.env.PORT || 4000);
server.listen(port, process.env.HOST || "127.0.0.1", () => {
  console.info(`PCCC pccc-BE listening on port ${port}`);
});
// Also generate deadline reminders when no browser is open. Per-day dedupe keys keep sweeps idempotent.
function sweepReportReminders() {
  try {
    const accounts = db
      .prepare(
        `SELECT a.* FROM accounts a JOIN roles r ON r.code=a.role_code
      WHERE a.status='active' AND r.enabled=1`,
      )
      .all();
    for (const account of accounts) refreshReportReminders(db, principalFor(db, account));
  } catch (error) {
    console.error("Report reminder sweep failed", { name: error.name });
  }
}
sweepReportReminders();
const reminderTimer = setInterval(sweepReportReminders, 60 * 60 * 1000);
reminderTimer.unref();
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    clearInterval(reminderTimer);
    server.close(() => {
      db.close();
      process.exit(0);
    });
  });
