import { DatabaseSync } from "node:sqlite";
import {
  existsSync,
  linkSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import { openDatabase, transaction } from "../src/database.js";
import { seedDemo } from "../src/seed.js";
import { audit } from "../src/authentication.js";

const marker = "M09_DEMO_UNCONFIRMED_Q11_Q12";
const repoDirectory = fileURLToPath(new URL("../../", import.meta.url));
const demoDocumentName = "00000000-0000-4000-8000-000000000009.txt";
const demoDocument = Buffer.from(
  "M09 DEMO: Tai lieu gia lap kiem thu. Khong co du lieu ca nhan, tai lieu mat hay thong tin nghiep vu that.\n",
  "utf8",
);

function canonicalPath(input) {
  const absolute = resolve(input);
  if (existsSync(absolute)) return realpathSync(absolute);
  const parent = dirname(absolute);
  if (parent === absolute) return absolute;
  return join(canonicalPath(parent), basename(absolute));
}

function samePath(left, right) {
  return left.toLowerCase() === right.toLowerCase();
}

function hasDemoMarker(db) {
  return (
    db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='m09_demo_seed'").get() &&
    db.prepare("SELECT value FROM m09_demo_seed WHERE name='purpose'").get()?.value === marker
  );
}

/** Guard before opening through openDatabase, which applies migrations. */
export function verifyDemoTarget(databasePath, uploadsDirectory) {
  if (process.env.NODE_ENV === "production")
    throw new Error("Demo seed is prohibited in production.");
  const database = canonicalPath(databasePath);
  const liveDatabase = canonicalPath(join(repoDirectory, "Backend", "data", "pccc.sqlite"));
  if (
    basename(database).toLowerCase() !== "incidents-demo.sqlite" ||
    samePath(database, liveDatabase)
  )
    throw new Error(
      "Use a separate database named incidents-demo.sqlite; the live database is prohibited.",
    );
  if (existsSync(database)) {
    const db = new DatabaseSync(database, { readOnly: true });
    try {
      if (!hasDemoMarker(db))
        throw new Error("Existing database is not an explicitly marked M09 demo database.");
    } finally {
      db.close();
    }
  }
  const uploads = canonicalPath(uploadsDirectory);
  if (basename(uploads).toLowerCase() !== "incidents-demo-uploads")
    throw new Error("Use a private upload directory named incidents-demo-uploads.");
  const publicDirectory = canonicalPath(join(repoDirectory, "public"));
  if (
    uploads.toLowerCase().startsWith(publicDirectory.toLowerCase() + "\\") ||
    uploads.toLowerCase().startsWith(publicDirectory.toLowerCase() + "/")
  )
    throw new Error("Demo uploads cannot be stored in the public directory.");
  if (existsSync(uploads)) {
    if (!statSync(uploads).isDirectory()) throw new Error("Demo uploads path is not a directory.");
    const markerPath = join(uploads, ".m09-demo-uploads");
    if (
      readdirSync(uploads).length &&
      (!existsSync(markerPath) || readFileSync(markerPath, "utf8").trim() !== marker)
    )
      throw new Error("Existing uploads directory is not an explicitly marked M09 demo directory.");
  }
  return { database, uploads };
}

/** Only memory fixtures or explicitly marked demo databases may use this helper. */
export function seedIncidentsDemo(db, { uploadsDirectory, now = Date.now() }) {
  if (process.env.NODE_ENV === "production")
    throw new Error("Demo seed is prohibited in production.");
  const file = db
    .prepare("PRAGMA database_list")
    .all()
    .find((entry) => entry.name === "main")?.file;
  if (file && (basename(file).toLowerCase() !== "incidents-demo.sqlite" || !hasDemoMarker(db)))
    throw new Error("Incident seed is limited to isolated demo/test databases.");
  if (!Number.isSafeInteger(now) || now < 0) throw new Error("Invalid demo time.");
  if (!uploadsDirectory) throw new Error("A private demo/test upload directory is required.");
  for (const [table, id] of [
    ["accounts", "DEMO-A04"],
    ["regions", "KP01"],
    ["units", "DV-KV10"],
    ["facilities", "CS001"],
    ["officers", "CB-A03"],
    ["officers", "CB-A04"],
  ])
    if (!db.prepare(`SELECT 1 FROM ${table} WHERE id=?`).get(id))
      throw new Error("Seed the isolated authentication/organization demo fixture first.");
  const actor = "DEMO-A04";
  const hour = 3600000;
  const day = 24 * hour;
  const fixtures = [
    {
      id: "DEMO-INC-FIRE",
      type: "FIRE",
      title: "Cháy kho giả lập",
      occurred: now - 2 * day,
      status: "IN_PROGRESS",
      deadline: now - hour,
    },
    {
      id: "DEMO-INC-EXPLOSION",
      type: "EXPLOSION",
      title: "Sự cố nổ giả lập",
      occurred: now - day,
      status: "NEW",
      deadline: now + 6 * hour,
    },
    {
      id: "DEMO-INC-RESCUE",
      type: "RESCUE",
      title: "Cứu hộ giả lập đã hoàn thành",
      occurred: now - 14 * day,
      status: "COMPLETED",
      deadline: now - 8 * day,
      completed: now - 7 * day,
    },
    {
      id: "DEMO-INC-MEDICAL",
      type: "MEDICAL",
      title: "Hỗ trợ y tế giả lập",
      occurred: now - 3 * hour,
      status: "NEW",
      deadline: null,
    },
    {
      id: "DEMO-INC-DRAFT",
      type: null,
      title: "Hồ sơ nháp giả lập",
      occurred: null,
      status: "NEW",
      deadline: null,
      draft: true,
    },
  ];
  const directory = canonicalPath(uploadsDirectory);
  const publicDirectory = canonicalPath(join(repoDirectory, "public")).toLowerCase();
  if (
    directory.toLowerCase() === publicDirectory ||
    directory.toLowerCase().startsWith(publicDirectory + "\\") ||
    directory.toLowerCase().startsWith(publicDirectory + "/")
  )
    throw new Error("Demo uploads cannot be stored in public.");
  mkdirSync(directory, { recursive: true });
  const documentPath = join(directory, demoDocumentName);
  const existingMetadata = db
    .prepare("SELECT storage_key,size_bytes FROM incident_documents WHERE id='DEMO-DOC-1'")
    .get();
  if (
    existingMetadata &&
    (existingMetadata.storage_key !== demoDocumentName ||
      existingMetadata.size_bytes !== demoDocument.length)
  )
    throw new Error("Refusing to overwrite changed demo document metadata.");
  const occupiedKey = db
    .prepare("SELECT id FROM incident_documents WHERE storage_key=?")
    .get(demoDocumentName);
  if (occupiedKey && occupiedKey.id !== "DEMO-DOC-1")
    throw new Error("Demo document storage key is already in use.");
  let createdDocument = false;
  if (existsSync(documentPath)) {
    if (!readFileSync(documentPath).equals(demoDocument))
      throw new Error("Refusing to overwrite an existing upload.");
  } else {
    const temporaryPath = join(directory, `.${demoDocumentName}-${randomUUID()}.tmp`);
    try {
      writeFileSync(temporaryPath, demoDocument, { flag: "wx" });
      // The hard link creates the destination atomically and refuses collisions.
      linkSync(temporaryPath, documentPath);
      createdDocument = true;
    } finally {
      if (existsSync(temporaryPath)) rmSync(temporaryPath);
    }
  }
  try {
    transaction(db, () => {
      const insertIncident = db.prepare(`INSERT OR IGNORE INTO incidents
        (id,incident_code,incident_type,title,description,occurred_at,reported_at,address,scene_details,
         region_id,unit_id,facility_id,record_status,processing_status,deadline_at,completed_at,
         created_by,updated_by,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
      for (const item of fixtures) {
        const result = insertIncident.run(
          item.id,
          item.id,
          item.type,
          item.title,
          "Dữ liệu hoàn toàn giả lập phục vụ demo M09; không phải hồ sơ nghiệp vụ.",
          item.occurred,
          item.occurred === null ? now : item.occurred + 300000,
          item.draft ? "" : "Địa điểm giả lập — không dùng thông tin thực tế",
          "Hiện trường giả lập; danh mục và quy tắc thời hạn chờ xác nhận Q11/Q12.",
          "KP01",
          "DV-KV10",
          "CS001",
          item.draft ? "DRAFT" : "OFFICIAL",
          item.status,
          item.deadline,
          item.completed ?? null,
          actor,
          actor,
          now,
          now,
        );
        if (result.changes) {
          db.prepare(
            `INSERT INTO incident_status_history
            (incident_id,from_status,to_status,from_record_status,to_record_status,
             old_deadline_at,new_deadline_at,changed_by,changed_at,reason,notes)
            VALUES (?,NULL,?,NULL,?,NULL,?,?,?,'DEMO_SEED','Dữ liệu giả lập')`,
          ).run(item.id, item.status, item.draft ? "DRAFT" : "OFFICIAL", item.deadline, actor, now);
          audit(
            db,
            actor,
            "incident.demo_seeded",
            item.id,
            null,
            {
              id: item.id,
              recordStatus: item.draft ? "DRAFT" : "OFFICIAL",
              processingStatus: item.status,
            },
            "demo-seed",
          );
        }
      }
      const damage = db.prepare(`INSERT OR IGNORE INTO incident_damages
        (id,incident_id,damage_group,damage_type,quantity,property_value,description,notes,updated_by,created_at,updated_at)
        VALUES (?,?,?,?,?,?,'Thiệt hại giả lập','Không chứa danh tính người gặp nạn',?,?,?)`);
      for (const row of [
        ["DEMO-DAMAGE-1", "DEMO-INC-FIRE", "HUMAN", "INJURED", 2, 0],
        ["DEMO-DAMAGE-2", "DEMO-INC-FIRE", "HUMAN", "RESCUED", 3, 0],
        ["DEMO-DAMAGE-3", "DEMO-INC-FIRE", "PROPERTY", "LOSS", 1, 12500000],
        ["DEMO-DAMAGE-4", "DEMO-INC-EXPLOSION", "PROPERTY", "LOSS", 1, 5000000],
        ["DEMO-DAMAGE-5", "DEMO-INC-RESCUE", "HUMAN", "RESCUED", 2, 0],
      ])
        damage.run(...row, actor, now, now);
      const assignment = db.prepare(`INSERT OR IGNORE INTO incident_assignments
        (id,incident_id,officer_id,assigned_by,task_description,deadline_at,status,notes,assigned_at,completed_at,updated_at)
        VALUES (?,?,?,?,?,?,?,'Phân công giả lập',?,?,?)`);
      assignment.run(
        "DEMO-ASSIGN-1",
        "DEMO-INC-FIRE",
        "CB-A03",
        actor,
        "Khảo sát hiện trường giả lập",
        now + 3 * hour,
        "IN_PROGRESS",
        now,
        null,
        now,
      );
      assignment.run(
        "DEMO-ASSIGN-2",
        "DEMO-INC-FIRE",
        "CB-A04",
        actor,
        "Tổng hợp hồ sơ giả lập",
        now + 4 * hour,
        "ASSIGNED",
        now,
        null,
        now,
      );
      assignment.run(
        "DEMO-ASSIGN-3",
        "DEMO-INC-RESCUE",
        "CB-A03",
        actor,
        "Tổng hợp cứu hộ giả lập",
        now - 8 * day,
        "COMPLETED",
        now - 14 * day,
        now - 7 * day,
        now,
      );
      db.prepare(
        `INSERT OR IGNORE INTO incident_documents
        (id,incident_id,original_name,stored_name,file_type,mime_type,size_bytes,storage_key,uploaded_by,uploaded_at)
        VALUES ('DEMO-DOC-1','DEMO-INC-FIRE','tai-lieu-gia-lap.txt',?,'txt','text/plain',?,?,?,?)`,
      ).run(demoDocumentName, demoDocument.length, demoDocumentName, actor, now);
    });
  } catch (error) {
    if (createdDocument) rmSync(documentPath);
    throw error;
  }
  return {
    incidents: db
      .prepare("SELECT count(*) AS total FROM incidents WHERE id LIKE 'DEMO-INC-%'")
      .get().total,
    damages: db
      .prepare("SELECT count(*) AS total FROM incident_damages WHERE id LIKE 'DEMO-DAMAGE-%'")
      .get().total,
    assignments: db
      .prepare("SELECT count(*) AS total FROM incident_assignments WHERE id LIKE 'DEMO-ASSIGN-%'")
      .get().total,
    documents: db
      .prepare("SELECT count(*) AS total FROM incident_documents WHERE id='DEMO-DOC-1'")
      .get().total,
  };
}

export async function runDemoSeed(
  argv = process.argv.slice(2),
  password = process.env.DEMO_PASSWORD,
) {
  let databasePath,
    uploadsDirectory,
    explicitDemo = false;
  for (let index = 0; index < argv.length; index++) {
    if (argv[index] === "--database") databasePath = argv[++index];
    else if (argv[index] === "--uploads") uploadsDirectory = argv[++index];
    else if (argv[index] === "--demo") explicitDemo = true;
    else throw new Error("Unknown demo seed option.");
  }
  if (!explicitDemo || !databasePath || !uploadsDirectory)
    throw new Error(
      "Required: --demo --database <incidents-demo.sqlite> --uploads <incidents-demo-uploads>.",
    );
  if (typeof password !== "string" || password.length < 12 || password.length > 256)
    throw new Error("Set DEMO_PASSWORD to a temporary password with 12–256 characters.");
  const target = verifyDemoTarget(databasePath, uploadsDirectory);
  mkdirSync(target.uploads, { recursive: true });
  writeFileSync(join(target.uploads, ".m09-demo-uploads"), `${marker}\n`, { flag: "w" });
  const db = openDatabase(target.database);
  try {
    db.exec("CREATE TABLE IF NOT EXISTS m09_demo_seed(name TEXT PRIMARY KEY,value TEXT NOT NULL)");
    db.prepare("INSERT OR IGNORE INTO m09_demo_seed VALUES ('purpose',?)").run(marker);
    await seedDemo(db, password);
    const counts = seedIncidentsDemo(db, { uploadsDirectory: target.uploads });
    const foreignKeyViolations = db.prepare("PRAGMA foreign_key_check").all();
    if (foreignKeyViolations.length) throw new Error("Demo database has foreign key violations.");
    return { ...counts, database: target.database, uploadsDirectory: target.uploads };
  } finally {
    db.close();
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  runDemoSeed()
    .then((result) => {
      console.info(JSON.stringify(result));
      console.info(
        "M09 demo only. No M09 permissions granted. Configure approved permissions at /quan-tri/vai-tro.",
      );
    })
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
