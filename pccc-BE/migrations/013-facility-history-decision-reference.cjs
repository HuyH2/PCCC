// An earlier version of migration 011 was applied without this column. SQLite
// lacks ADD COLUMN IF NOT EXISTS, so this migration checks the live schema.
module.exports = (db) => {
  const columns = db.prepare("PRAGMA table_info(facility_status_history)").all();
  if (!columns.some((column) => column.name === "decision_reference")) {
    db.exec("ALTER TABLE facility_status_history ADD COLUMN decision_reference TEXT");
  }
};
