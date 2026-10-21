import { writeAudit } from "../modules/audit/audit.service.js";

export function seedLegalDocuments(db) {
  const categories = {
    law: "Luật",
    decree: "Nghị định",
    circular: "Thông tư",
    standard: "Quy chuẩn/Tiêu chuẩn",
    directive: "Công văn chỉ đạo",
    guide: "Hướng dẫn nghiệp vụ",
  };
  for (const [id, name] of Object.entries(categories))
    db.prepare("INSERT OR IGNORE INTO legal_document_categories(id,name) VALUES (?,?)").run(
      id,
      name,
    );
  for (const [index, category] of Object.keys(categories).entries()) {
    const id = `DEMO-DOC-${index + 1}`;
    if (db.prepare("SELECT 1 FROM legal_documents WHERE id=?").get(id)) continue;
    const now = Date.now();
    const status = ["effective", "expired", "pending"][index % 3];
    db.prepare(
      `INSERT INTO legal_documents(id,category_id,title,reference_number,issuing_authority,effective_date,status,source_url,notes,created_by,updated_by,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).run(
      id,
      category,
      `${categories[category]} về PCCC (dữ liệu mẫu)`,
      `MAU-${index + 1}/2026`,
      "Cơ quan giả lập",
      "2026-01-01",
      status,
      "https://example.org/",
      "Dữ liệu giả lập, không có giá trị pháp lý.",
      "DEMO-A05",
      "DEMO-A05",
      now,
      now,
    );
    writeAudit(db, {
      actorId: "DEMO-A05",
      feature: "M05",
      objectType: "legal_document",
      objectId: id,
      action: "legal_document.seeded",
      after: { id, category_id: category, status, demo: true },
      ip: "seed",
    });
  }
}
