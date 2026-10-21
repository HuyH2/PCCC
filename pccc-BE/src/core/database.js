import pg from "pg";
import { AsyncLocalStorage } from "node:async_hooks";
import { mkdirSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const migrationDirectory = fileURLToPath(new URL("../../migrations/", import.meta.url));

// BIGINT/NUMERIC arrive as strings by default; every value in this schema fits in a JS number.
// Booleans from expressions (EXISTS, a=b) become 1/0 so flags keep the 0/1 shape used everywhere.
const BIGINT = 20;
const NUMERIC = 1700;
const BOOLEAN = 16;
const parsers = {
  [BIGINT]: (value) => Number(value),
  [NUMERIC]: (value) => Number(value),
  [BOOLEAN]: (value) => (value === "t" || value === true ? 1 : 0),
};

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

const placeholderCache = new Map();
/** Rewrites SQLite-style `?` placeholders to `$1..$n`, skipping quoted text and comments. */
export function toPostgresPlaceholders(sql) {
  const cached = placeholderCache.get(sql);
  if (cached) return cached;
  let out = "";
  let index = 0;
  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    if (char === "'" || char === '"') {
      const end = sql.indexOf(char, i + 1);
      const stop = end === -1 ? sql.length : end + 1;
      out += sql.slice(i, stop);
      i = stop - 1;
    } else if (char === "-" && sql[i + 1] === "-") {
      const end = sql.indexOf("\n", i);
      const stop = end === -1 ? sql.length : end;
      out += sql.slice(i, stop);
      i = stop - 1;
    } else if (char === "?") {
      out += `$${++index}`;
    } else {
      out += char;
    }
  }
  placeholderCache.set(sql, out);
  return out;
}

function bindValue(value) {
  if (value === undefined) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  return value;
}

/** Serializes work so one transaction runs at a time, like SQLite's BEGIN IMMEDIATE. */
function createLock() {
  let tail = Promise.resolve();
  return async function withLock(work) {
    const previous = tail;
    let release;
    tail = new Promise((resolve) => (release = resolve));
    await previous;
    try {
      return await work();
    } finally {
      release();
    }
  };
}

class Statement {
  constructor(db, sql) {
    this.db = db;
    this.sql = toPostgresPlaceholders(sql);
  }
  async all(...params) {
    return (await this.db.query(this.sql, params)).rows;
  }
  async get(...params) {
    return (await this.db.query(this.sql, params)).rows[0];
  }
  /** Returns { changes }, plus the first RETURNING row's id as lastInsertRowid when present. */
  async run(...params) {
    const result = await this.db.query(this.sql, params);
    return { changes: result.rowCount ?? 0, lastInsertRowid: result.rows?.[0]?.id };
  }
}

/**
 * Async database handle shared by every module. Queries made inside transaction(db, work)
 * automatically use the transaction's connection (tracked with AsyncLocalStorage).
 */
class Database {
  #driver;
  #context = new AsyncLocalStorage();
  #lock = createLock();

  /** @param location ":memory:", "postgres" or the embedded database directory. */
  constructor(driver, location) {
    this.#driver = driver;
    this.location = location;
  }

  prepare(sql) {
    return new Statement(this, sql);
  }

  async query(sql, params = []) {
    const values = params.map(bindValue);
    const active = this.#context.getStore();
    if (active) return active.query(sql, values);
    return this.#driver.query(sql, values);
  }

  /** Runs one or more statements without parameters (DDL, scripts). */
  async exec(sql) {
    const active = this.#context.getStore();
    if (active) return active.exec(sql);
    return this.#driver.exec(sql);
  }

  async transaction(work) {
    const active = this.#context.getStore();
    if (active) {
      // Nested call: a savepoint keeps the inner work atomic inside the outer transaction.
      const name = `sp_${++active.depth}`;
      await active.exec(`SAVEPOINT ${name}`);
      try {
        const result = await work();
        await active.exec(`RELEASE SAVEPOINT ${name}`);
        return result;
      } catch (error) {
        await active.exec(`ROLLBACK TO SAVEPOINT ${name}`);
        throw error;
      }
    }
    return this.#lock(() =>
      this.#driver.withConnection(async (connection) => {
        connection.depth = 0;
        await connection.exec("BEGIN");
        try {
          const result = await this.#context.run(connection, work);
          await connection.exec("COMMIT");
          return result;
        } catch (error) {
          await connection.exec("ROLLBACK");
          throw error;
        }
      }),
    );
  }

  async close() {
    await this.#driver.close();
  }
}

export function transaction(db, work) {
  return db.transaction(work);
}

function postgresDriver(connectionString) {
  const pool = new pg.Pool({
    connectionString,
    types: { getTypeParser: (oid, format) => parsers[oid] ?? pg.types.getTypeParser(oid, format) },
  });
  const wrap = (client) => ({
    query: (sql, values) => client.query(sql, values),
    exec: (sql) => client.query(sql),
  });
  return {
    query: (sql, values) => pool.query(sql, values),
    exec: (sql) => pool.query(sql),
    async withConnection(work) {
      const client = await pool.connect();
      try {
        return await work(wrap(client));
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}

// Embedded PostgreSQL (PGlite): a data directory for local development, or memory for tests.
async function createPglite(dataDir) {
  const { PGlite } = await import("@electric-sql/pglite");
  const { citext } = await import("@electric-sql/pglite/contrib/citext");
  return PGlite.create({ dataDir, extensions: { citext }, parsers });
}

// Tests build the migrated schema once per process, then clone it for each database.
let templatePromise;
async function memoryTemplate() {
  const template = await createPglite();
  await migrate(new Database(pgliteDriver(template), ":memory:"));
  return template;
}

function pgliteDriver(instance) {
  // PGlite has a single connection, so every top-level query waits for an open transaction.
  const lock = createLock();
  const connection = {
    query: async (sql, values) => {
      // Clones do not inherit creation-time parsers, so pass them on every query.
      const result = await instance.query(sql, values, { parsers });
      return { rows: result.rows, rowCount: result.affectedRows ?? 0 };
    },
    exec: async (sql) => {
      await instance.exec(sql);
      return { rows: [], rowCount: 0 };
    },
  };
  return {
    query: (sql, values) => lock(() => connection.query(sql, values)),
    exec: (sql) => lock(() => connection.exec(sql)),
    withConnection: (work) => lock(() => work({ ...connection })),
    close: () => instance.close(),
  };
}

async function migrate(db) {
  await db.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at BIGINT NOT NULL)",
  );
  for (const name of readdirSync(migrationDirectory)
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    await db.transaction(async () => {
      // Serializes concurrent starts (several app instances) on the same database.
      await db.exec("SELECT pg_advisory_xact_lock(724001)");
      if (await db.prepare("SELECT 1 FROM schema_migrations WHERE name=?").get(name)) return;
      await db.exec(readFileSync(resolve(migrationDirectory, name), "utf8"));
      await db.prepare("INSERT INTO schema_migrations VALUES (?,?)").run(name, Date.now());
    });
  }
  return db;
}

/**
 * Opens the database named by DATABASE_URL and applies pending migrations:
 * - postgres:// or postgresql:// URL: a PostgreSQL server (production, Neon, local server);
 * - any other value: a directory holding an embedded PostgreSQL (PGlite) database, so local
 *   development needs no database server;
 * - ":memory:": an isolated in-process database for tests.
 */
export async function openDatabase(
  url = process.env.DATABASE_URL || "./data/pccc-pg",
  { migrations = true } = {},
) {
  if (url === ":memory:") {
    if (process.env.PCCC_TEST_DATABASE_URL) return openServerTestDatabase();
    templatePromise ??= memoryTemplate();
    const instance = await (await templatePromise).clone();
    return new Database(pgliteDriver(instance), ":memory:");
  }
  let db;
  if (isPostgresUrl(url)) db = new Database(postgresDriver(url), "postgres");
  else {
    const directory = resolve(url);
    mkdirSync(directory, { recursive: true });
    db = new Database(pgliteDriver(await createPglite(directory)), directory);
  }
  return migrations ? migrate(db) : db;
}

// PCCC_TEST_DATABASE_URL runs the test suite against a real PostgreSQL server instead of
// PGlite: each ":memory:" database is a fresh server database, dropped again on close.
let testDatabaseCounter = 0;
async function openServerTestDatabase() {
  const adminUrl = process.env.PCCC_TEST_DATABASE_URL;
  const name = `pccc_test_${process.pid}_${++testDatabaseCounter}`;
  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE ${name}`);
  } finally {
    await admin.end();
  }
  const url = new URL(adminUrl);
  url.pathname = `/${name}`;
  const db = await migrate(new Database(postgresDriver(url.href), ":memory:"));
  const close = db.close.bind(db);
  db.close = async () => {
    await close();
    const cleanup = new pg.Client({ connectionString: adminUrl });
    await cleanup.connect();
    try {
      await cleanup.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    } finally {
      await cleanup.end();
    }
  };
  return db;
}

export function isPostgresUrl(url) {
  return /^postgres(ql)?:\/\//.test(url);
}
