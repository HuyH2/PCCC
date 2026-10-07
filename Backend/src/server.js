import { openDatabase } from "./database.js";
import { createApp } from "./app.js";

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
  console.info(`PCCC Backend listening on port ${port}`);
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () =>
    server.close(() => {
      db.close();
      process.exit(0);
    }),
  );
