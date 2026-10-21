import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, join, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { openDatabase, transaction } from "../src/core/database.js";
import { audit } from "../src/modules/audit/audit.service.js";

const day = 86_400_000;
const hour = 3_600_000;
const actor = "DEMO-A05";
const types = ["FIRE", "EXPLOSION", "RESCUE", "MEDICAL"];
const typeNames = ["Cháy", "Nổ", "Cứu nạn cứu hộ", "Hỗ trợ y tế"];
const regions = [
  { id: "KP01", unitId: "DV-KV10", facilityId: "CS001", officerId: "CB-A03" },
  { id: "KP02", unitId: "DV-KV10", facilityId: "CS002", officerId: "CB-A04" },
  { id: "KP03", unitId: "DV-KV11", facilityId: "CS003", officerId: "CB-OTHER" },
];
const documentNumbers = [1, 25, 50, 75];

function incidentId(number) {
  return `DEMO-M09-${String(number).padStart(3, "0")}`;
}

function assertDemoData(db) {
  const foreignAccounts = db
    .prepare("SELECT count(*) AS total FROM accounts WHERE username NOT LIKE 'demo.%'")
    .get().total;
  const accountCount = db.prepare("SELECT count(*) AS total FROM accounts").get().total;
  if (foreignAccounts || accountCount < 6) {
    throw new Error("Chỉ nạp dữ liệu M09 vào database chứa các tài khoản demo của dự án.");
  }
  for (const [table, id] of [
    ["accounts", actor],
    ["officers", "CB-A03"],
    ["officers", "CB-A04"],
    ["officers", "CB-OTHER"],
    ...regions.flatMap((region) => [
      ["regions", region.id],
      ["units", region.unitId],
      ["facilities", region.facilityId],
    ]),
  ]) {
    if (!db.prepare(`SELECT 1 FROM ${table} WHERE id=?`).get(id)) {
      throw new Error(`Thiếu dữ liệu demo ${table}:${id}; chạy pnpm seed trước.`);
    }
  }
}

function documentContent(number) {
  return Buffer.from(
    `M09 DEMO ${incidentId(number)}: tai lieu gia lap de kiem thu giao dien. Khong chua du lieu that.\n`,
    "utf8",
  );
}

export function seedIncidentsBulk(db, { now = Date.now(), uploadDirectory } = {}) {
  if (process.env.NODE_ENV === "production")
    throw new Error("Không nạp dữ liệu demo ở production.");
  if (!Number.isSafeInteger(now) || now < 120 * day)
    throw new Error("Thời gian seed không hợp lệ.");
  if (!uploadDirectory) throw new Error("Cần thư mục tài liệu riêng cho M09.");
  assertDemoData(db);

  const uploads = resolve(uploadDirectory);
  const publicDirectory = resolve("../pccc-FE/public");
  if (uploads === publicDirectory || uploads.startsWith(`${publicDirectory}${sep}`)) {
    throw new Error("Không lưu tài liệu M09 trong public.");
  }
  mkdirSync(uploads, { recursive: true });
  const createdFiles = [];
  try {
    for (const number of documentNumbers) {
      const file = join(uploads, `demo-m09-${String(number).padStart(3, "0")}.txt`);
      const content = documentContent(number);
      if (existsSync(file)) {
        if (!readFileSync(file).equals(content))
          throw new Error(`Tệp demo đã bị thay đổi: ${file}`);
      } else {
        writeFileSync(file, content, { flag: "wx" });
        createdFiles.push(file);
      }
    }

    let inserted = 0;
    transaction(db, () => {
      const insertIncident = db.prepare(`INSERT INTO incidents
        (id,incident_code,incident_type,title,description,occurred_at,reported_at,address,scene_details,
         region_id,unit_id,facility_id,record_status,processing_status,deadline_at,completed_at,
         created_by,updated_by,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING`);
      const insertHistory = db.prepare(`INSERT INTO incident_status_history
        (incident_id,from_status,to_status,from_record_status,to_record_status,old_deadline_at,
         new_deadline_at,changed_by,changed_at,reason,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
      const insertDamage = db.prepare(`INSERT INTO incident_damages
        (id,incident_id,damage_group,damage_type,quantity,property_value,description,notes,
         updated_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
      const insertAssignment = db.prepare(`INSERT INTO incident_assignments
        (id,incident_id,officer_id,assigned_by,task_description,deadline_at,status,notes,
         assigned_at,completed_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
      const insertDocument = db.prepare(`INSERT INTO incident_documents
        (id,incident_id,original_name,stored_name,file_type,mime_type,size_bytes,storage_key,
         uploaded_by,uploaded_at) VALUES (?,?,?,?,?,?,?,?,?,?)`);

      for (let number = 1; number <= 80; number++) {
        const id = incidentId(number);
        const draft = number % 11 === 0;
        const region = regions[(number - 1) % regions.length];
        const typeIndex = (number - 1) % types.length;
        const occurred = now - (((number * 3) % 120) + 1) * day - (number % 12) * hour;
        const reported = occurred + 5 * 60_000;
        const status = draft
          ? "NEW"
          : ["NEW", "IN_PROGRESS", "COMPLETED", "CLOSED"][(number - 1) % 4];
        const deadline =
          draft || number % 7 === 0
            ? null
            : status === "COMPLETED" || status === "CLOSED"
              ? now - ((number % 15) + 1) * day
              : number % 3 === 0
                ? now - ((number % 10) + 1) * day
                : number % 3 === 1
                  ? now + 12 * hour
                  : now + ((number % 12) + 3) * day;
        const completed = ["COMPLETED", "CLOSED"].includes(status)
          ? now - ((number % 12) + 1) * hour
          : null;
        const result = insertIncident.run(
          id,
          id,
          draft ? null : types[typeIndex],
          `${typeNames[typeIndex]} giả lập ${String(number).padStart(3, "0")} — ${region.id}`,
          "Dữ liệu hoàn toàn giả lập phục vụ kiểm thử Incident Management; không phải sự cố thực.",
          draft ? null : occurred,
          reported,
          draft ? "" : `Địa điểm giả lập số ${number}, ${region.id}`,
          draft ? "" : `Hiện trường giả lập của hồ sơ ${id}; không chứa dữ liệu cá nhân.`,
          region.id,
          region.unitId,
          number % 5 === 0 ? null : region.facilityId,
          draft ? "DRAFT" : "OFFICIAL",
          status,
          deadline,
          completed,
          actor,
          actor,
          reported,
          now,
        );
        if (!result.changes) continue;
        inserted++;
        insertHistory.run(
          id,
          null,
          "NEW",
          null,
          draft ? "DRAFT" : "OFFICIAL",
          null,
          deadline,
          actor,
          reported,
          "Tạo hồ sơ giả lập",
          "DEMO_M09_BULK",
        );
        if (["IN_PROGRESS", "COMPLETED", "CLOSED"].includes(status)) {
          insertHistory.run(
            id,
            "NEW",
            "IN_PROGRESS",
            draft ? "DRAFT" : "OFFICIAL",
            "OFFICIAL",
            deadline,
            deadline,
            actor,
            reported + hour,
            "Bắt đầu xử lý giả lập",
            "DEMO_M09_BULK",
          );
        }
        if (["COMPLETED", "CLOSED"].includes(status)) {
          insertHistory.run(
            id,
            "IN_PROGRESS",
            "COMPLETED",
            "OFFICIAL",
            "OFFICIAL",
            deadline,
            deadline,
            actor,
            completed,
            "Hoàn thành xử lý giả lập",
            "DEMO_M09_BULK",
          );
        }
        if (status === "CLOSED") {
          insertHistory.run(
            id,
            "COMPLETED",
            "CLOSED",
            "OFFICIAL",
            "OFFICIAL",
            deadline,
            deadline,
            actor,
            completed + 60_000,
            "Đóng hồ sơ giả lập",
            "DEMO_M09_BULK",
          );
        }
        if (!draft && number % 3 !== 0) {
          insertDamage.run(
            `${id}-H`,
            id,
            "HUMAN",
            number % 4 === 0 ? "RESCUED" : "INJURED",
            (number % 5) + 1,
            0,
            "Thiệt hại về người giả lập",
            "Không có danh tính cá nhân",
            actor,
            reported + hour,
            now,
          );
          insertDamage.run(
            `${id}-P`,
            id,
            "PROPERTY",
            "LOSS",
            1,
            number * 350_000,
            "Thiệt hại tài sản giả lập",
            "Giá trị chỉ dùng cho kiểm thử thống kê",
            actor,
            reported + hour,
            now,
          );
        }
        if (!draft && number % 2 === 0) {
          const assignmentDone = ["COMPLETED", "CLOSED"].includes(status);
          insertAssignment.run(
            `${id}-A`,
            id,
            region.officerId,
            actor,
            `Xử lý hồ sơ giả lập ${id}`,
            deadline,
            assignmentDone ? "COMPLETED" : "IN_PROGRESS",
            "Phân công thử nghiệm",
            reported + hour,
            assignmentDone ? completed : null,
            now,
          );
        }
        if (documentNumbers.includes(number)) {
          const file = `demo-m09-${String(number).padStart(3, "0")}.txt`;
          insertDocument.run(
            `${id}-DOC`,
            id,
            file,
            file,
            "txt",
            "text/plain",
            documentContent(number).length,
            file,
            actor,
            reported + hour,
          );
        }
        audit(db, actor, "incident.demo_seeded", id, null, { id, status }, "demo-seed");
      }
      if (db.prepare("PRAGMA foreign_key_check").all().length) {
        throw new Error("Dữ liệu M09 có lỗi khóa ngoại.");
      }
    });
    return {
      inserted,
      total: db.prepare("SELECT count(*) AS total FROM incidents WHERE id LIKE 'DEMO-M09-%'").get()
        .total,
    };
  } catch (error) {
    for (const file of createdFiles) unlinkSync(file);
    throw error;
  }
}

export function runBulkSeed(argv = process.argv.slice(2)) {
  if (argv.length !== 1 || argv[0] !== "--demo") {
    throw new Error("Chỉ chạy lệnh seed:incidents:local với cờ --demo.");
  }
  if (process.env.NODE_ENV === "production")
    throw new Error("Không nạp dữ liệu demo ở production.");
  const databasePath = resolve(process.env.DATABASE_PATH || "./data/pccc.sqlite");
  const dataDirectory = resolve("./data");
  if (
    basename(databasePath) !== "pccc.sqlite" ||
    !databasePath.startsWith(`${dataDirectory}${sep}`)
  ) {
    throw new Error("Chỉ nạp vào database demo local pccc-BE/data/pccc.sqlite.");
  }
  if (!existsSync(databasePath))
    throw new Error("Database chưa tồn tại; chạy pnpm migrate và pnpm seed.");
  const verify = new DatabaseSync(databasePath, { readOnly: true });
  try {
    assertDemoData(verify);
  } finally {
    verify.close();
  }
  const db = openDatabase(databasePath);
  try {
    const uploadDirectory = resolve(
      process.env.INCIDENT_UPLOAD_DIR || "./src/private/incident-documents",
    );
    return { ...seedIncidentsBulk(db, { uploadDirectory }), databasePath };
  } finally {
    db.close();
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    console.info(JSON.stringify(runBulkSeed()));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
