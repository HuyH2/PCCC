import { randomUUID } from "node:crypto";
import { requirePermission } from "../authorization/authorization.service.js";
import { assert } from "../../core/errors.js";
import { object, pagination, text } from "../../core/validation.js";
import { transaction, foldSearchText } from "../../core/database.js";
import { writeAudit } from "../audit/audit.service.js";

export const MAX_DOCUMENT_BYTES = Number(process.env.LEGAL_DOCUMENT_MAX_BYTES ?? 5 * 1024 * 1024);
if (
  !Number.isInteger(MAX_DOCUMENT_BYTES) ||
  MAX_DOCUMENT_BYTES < 1024 ||
  MAX_DOCUMENT_BYTES > 5 * 1024 * 1024
)
  throw new Error("LEGAL_DOCUMENT_MAX_BYTES must be an integer between 1024 and 5242880.");
export const DOCUMENT_SIZE_MESSAGE = `File PDF tối đa ${MAX_DOCUMENT_BYTES / (1024 * 1024)} MB.`;
const columns = `d.id,d.category_id,c.name AS category_name,d.title,d.reference_number,d.issuing_authority,
  d.issued_date,d.effective_date,d.status,d.source_url,d.file_name,length(d.file_data) AS file_size,
  d.notes,d.version,d.created_by,d.updated_by,d.created_at,d.updated_at`;
const joined = "legal_documents d JOIN legal_document_categories c ON c.id=d.category_id";

export function requireDocumentAccess(user, action = "view") {
  if (action !== "view") requirePermission(user, "M05.view");
  requirePermission(user, `M05.${action}`);
  assert(
    user.scopes.length > 0 && (action === "view" || ["A01", "A05"].includes(user.role)),
    403,
    "FORBIDDEN",
    "Chỉ Chỉ huy hoặc Quản trị có phạm vi được cấp mới được quản lý kho văn bản.",
  );
}

export function documentCategories(db, user) {
  requireDocumentAccess(user);
  return db.prepare("SELECT * FROM legal_document_categories ORDER BY name").all();
}

export function documentDetail(db, user, id) {
  requireDocumentAccess(user);
  const row = db.prepare(`SELECT ${columns} FROM ${joined} WHERE d.id=?`).get(id);
  assert(row, 404, "NOT_FOUND", "Không tìm thấy văn bản.");
  return row;
}

export function listDocuments(db, user, url) {
  requireDocumentAccess(user);
  const { page, pageSize } = pagination(url);
  const q = text(url.searchParams.get("q") ?? "", "Từ khóa", 0, 200).trim();
  const clauses = ["(instr(fold(d.title),?)>0 OR instr(fold(d.reference_number),?)>0)"];
  const params = [foldSearchText(q), foldSearchText(q)];
  for (const [key, column] of [
    ["categoryId", "d.category_id"],
    ["status", "d.status"],
  ]) {
    const value = url.searchParams.get(key);
    if (!value) continue;
    text(value, key, 1, 100);
    if (key === "status")
      assert(
        ["effective", "expired", "pending"].includes(value),
        400,
        "INVALID_INPUT",
        "Trạng thái không hợp lệ.",
      );
    clauses.push(`${column}=?`);
    params.push(value);
  }
  const where = clauses.join(" AND ");
  return {
    items: db
      .prepare(
        `SELECT ${columns} FROM ${joined} WHERE ${where} ORDER BY d.updated_at DESC,d.id LIMIT ? OFFSET ?`,
      )
      .all(...params, pageSize, (page - 1) * pageSize),
    total: db.prepare(`SELECT count(*) AS n FROM ${joined} WHERE ${where}`).get(...params).n,
    page,
    pageSize,
  };
}

function date(value, label, optional = false) {
  if (optional && (value == null || value === "")) return null;
  assert(
    typeof value === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      Number.isFinite(Date.parse(value)) &&
      new Date(value).toISOString().slice(0, 10) === value,
    400,
    "INVALID_INPUT",
    `${label} không hợp lệ.`,
  );
  return value;
}

export function validateDocumentFile(name, data) {
  text(name, "Tên file", 1, 180);
  assert(
    !/[\\/\x00-\x1f\x7f]/.test(name) && /\.pdf$/i.test(name),
    400,
    "INVALID_FILE",
    "Chỉ nhận file PDF với tên hợp lệ.",
  );
  assert(
    data.length > 0 && data.length <= MAX_DOCUMENT_BYTES,
    413,
    "FILE_TOO_LARGE",
    DOCUMENT_SIZE_MESSAGE,
  );
  assert(
    data.subarray(0, 5).toString() === "%PDF-" && data.subarray(-1024).toString().includes("%%EOF"),
    400,
    "INVALID_FILE",
    "Nội dung file PDF không hợp lệ.",
  );
  return { name, data };
}

function validateDocument(db, payload) {
  object(payload, [
    "category_id",
    "title",
    "reference_number",
    "issuing_authority",
    "issued_date",
    "effective_date",
    "status",
    "source_url",
    "notes",
    "version",
    "file",
  ]);
  const result = {};
  for (const [key, max] of [
    ["category_id", 100],
    ["title", 500],
    ["reference_number", 100],
    ["issuing_authority", 200],
  ])
    result[key] = text(
      typeof payload[key] === "string" ? payload[key].trim() : payload[key],
      key,
      1,
      max,
    );
  assert(
    db.prepare("SELECT 1 FROM legal_document_categories WHERE id=?").get(result.category_id),
    400,
    "INVALID_INPUT",
    "Loại văn bản không tồn tại.",
  );
  result.issued_date = date(payload.issued_date, "Ngày ban hành", true);
  result.effective_date = date(payload.effective_date, "Ngày hiệu lực");
  assert(
    ["effective", "expired", "pending"].includes(payload.status),
    400,
    "INVALID_INPUT",
    "Trạng thái hiệu lực không hợp lệ.",
  );
  result.status = payload.status;
  result.notes = text(payload.notes ?? "", "Ghi chú", 0, 4000).trim();
  result.source_url = null;
  if (payload.source_url != null && payload.source_url !== "") {
    const source = text(payload.source_url, "Đường dẫn", 1, 2048).trim();
    let parsed;
    try {
      parsed = new URL(source);
    } catch {
      /* Rejected below. */
    }
    assert(
      parsed &&
        ["http:", "https:"].includes(parsed.protocol) &&
        !parsed.username &&
        !parsed.password,
      400,
      "INVALID_INPUT",
      "Đường dẫn phải là HTTP/HTTPS, không chứa thông tin đăng nhập.",
    );
    result.source_url = parsed.href;
  }
  let file = null;
  if (payload.file != null) {
    object(payload.file, ["name", "contentBase64"]);
    const content = text(
      payload.file.contentBase64,
      "File",
      1,
      Math.ceil(MAX_DOCUMENT_BYTES / 3) * 4,
    );
    const data = Buffer.from(content, "base64");
    assert(data.toString("base64") === content, 400, "INVALID_FILE", "File mã hóa không hợp lệ.");
    file = validateDocumentFile(payload.file.name, data);
  }
  return { values: result, file };
}

export function saveDocument(db, user, payload, id, ip) {
  requireDocumentAccess(user, id ? "edit" : "create");
  const { values: v, file } = validateDocument(db, payload);
  return transaction(db, () => {
    const before = id ? documentDetail(db, user, id) : null;
    if (before)
      assert(
        Number.isInteger(payload.version) && before.version === payload.version,
        409,
        "VERSION_CONFLICT",
        "Văn bản đã được thay đổi. Hãy tải lại trước khi lưu.",
      );
    assert(
      v.source_url || file || before?.file_name,
      400,
      "INVALID_INPUT",
      "Vui lòng cung cấp file PDF hoặc đường dẫn văn bản.",
    );
    const duplicate = db
      .prepare("SELECT id FROM legal_documents WHERE reference_number=? AND id<>?")
      .get(v.reference_number, id ?? "");
    assert(!duplicate, 409, "DUPLICATE_DOCUMENT", "Số/ký hiệu văn bản đã tồn tại.");
    const now = Date.now();
    const documentId = id ?? randomUUID();
    if (before) {
      db.prepare(
        `UPDATE legal_documents SET category_id=?,title=?,reference_number=?,issuing_authority=?,issued_date=?,effective_date=?,status=?,source_url=?,notes=?,updated_by=?,updated_at=?,version=version+1 WHERE id=?`,
      ).run(
        v.category_id,
        v.title,
        v.reference_number,
        v.issuing_authority,
        v.issued_date,
        v.effective_date,
        v.status,
        v.source_url,
        v.notes,
        user.id,
        now,
        documentId,
      );
      if (file)
        db.prepare("UPDATE legal_documents SET file_name=?,file_data=? WHERE id=?").run(
          file.name,
          file.data,
          documentId,
        );
    } else {
      db.prepare(
        `INSERT INTO legal_documents(id,category_id,title,reference_number,issuing_authority,issued_date,effective_date,status,source_url,notes,file_name,file_data,created_by,updated_by,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      ).run(
        documentId,
        v.category_id,
        v.title,
        v.reference_number,
        v.issuing_authority,
        v.issued_date,
        v.effective_date,
        v.status,
        v.source_url,
        v.notes,
        file?.name ?? null,
        file?.data ?? null,
        user.id,
        user.id,
        now,
        now,
      );
    }
    const after = documentDetail(db, user, documentId);
    writeAudit(db, {
      actorId: user.id,
      feature: "M05",
      objectType: "legal_document",
      objectId: documentId,
      action: before ? "legal_document.updated" : "legal_document.created",
      before,
      after,
      ip,
    });
    return after;
  });
}

export function replaceDocumentFile(db, user, id, name, data, version, ip) {
  requireDocumentAccess(user, "edit");
  const file = validateDocumentFile(name, data);
  return transaction(db, () => {
    const before = documentDetail(db, user, id);
    assert(
      version === before.version,
      409,
      "VERSION_CONFLICT",
      "Văn bản đã thay đổi. Hãy tải lại.",
    );
    db.prepare(
      "UPDATE legal_documents SET file_name=?,file_data=?,version=version+1,updated_at=?,updated_by=? WHERE id=?",
    ).run(file.name, file.data, Date.now(), user.id, id);
    const after = documentDetail(db, user, id);
    writeAudit(db, {
      actorId: user.id,
      feature: "M05",
      objectType: "legal_document",
      objectId: id,
      action: "legal_document.file_uploaded",
      before,
      after,
      ip,
    });
    return after;
  });
}

export function documentHistory(db, user, id, url) {
  documentDetail(db, user, id);
  const { page, pageSize } = pagination(url);
  const where = "l.object_type='legal_document' AND l.object_id=?";
  return {
    items: db
      .prepare(
        `SELECT l.id,l.action,l.occurred_at,l.before_json,l.after_json,a.full_name AS actor_name
    FROM audit_logs l LEFT JOIN accounts a ON a.id=l.actor_id WHERE ${where} ORDER BY l.id DESC LIMIT ? OFFSET ?`,
      )
      .all(id, pageSize, (page - 1) * pageSize),
    total: db.prepare(`SELECT count(*) AS n FROM audit_logs l WHERE ${where}`).get(id).n,
    page,
    pageSize,
  };
}
