import { randomUUID } from "node:crypto";
import {
  closeSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ApiError, assert } from "../../core/errors.js";
import { transaction } from "../../core/database.js";
import { pagination, text } from "../../core/validation.js";
import { writeAudit } from "../audit/audit.service.js";
import { requirePermission } from "../authorization/authorization.service.js";
import { getFacility } from "./facilities.service.js";
import { personnelRow } from "./facility-personnel.service.js";

// ============================================================================
// Configuration & Constants
// ============================================================================

const privateDirectory = fileURLToPath(
  new URL("../../private/facility-attachments/", import.meta.url),
);

export const MAX_FACILITY_ATTACHMENT_BYTES = Number(
  process.env.FACILITY_ATTACHMENT_MAX_BYTES ?? 5 * 1024 * 1024,
);

if (
  !Number.isInteger(MAX_FACILITY_ATTACHMENT_BYTES) ||
  MAX_FACILITY_ATTACHMENT_BYTES < 1024 ||
  MAX_FACILITY_ATTACHMENT_BYTES > 10 * 1024 * 1024
) {
  throw new Error("FACILITY_ATTACHMENT_MAX_BYTES must be an integer between 1024 and 10485760.");
}

const attachmentColumns = `
  a.id,
  a.facility_id,
  a.personnel_id,
  a.document_type,
  a.description,
  a.original_name,
  a.content_type,
  a.size_bytes,
  a.uploaded_by,
  a.uploaded_at,
  p.full_name AS personnel_name,
  u.full_name AS uploaded_by_name
`.trim();

// ============================================================================
// Internal Text Validation Helpers
// ============================================================================

function trimmed(value, label, min, max) {
  text(value, label, min, max);
  return text(value.trim(), label, min, max);
}

function nullableText(value, label, max) {
  if (value == null || value === "") {
    return null;
  }
  return trimmed(value, label, 1, max);
}

// ============================================================================
// Storage Management & Path Traversal Guards
// ============================================================================

/**
 * Resolves and verifies the storage root directory for facility attachments.
 * Ensures the destination directory is strictly outside public folders,
 * not a symlink, and created with restricted permissions (0o700).
 */
function storageRoot(directory) {
  const configured = directory
    ? join(directory, "facility-attachments")
    : process.env.FACILITY_ATTACHMENT_DIR || privateDirectory;

  const path = resolve(configured);
  const publicRoot = resolve(
    fileURLToPath(new URL("../../../../pccc-FE/public/", import.meta.url)),
  );

  const normalizedPath = path.toLowerCase();
  const normalizedPublic = publicRoot.toLowerCase();

  assert(
    normalizedPath !== normalizedPublic &&
      !normalizedPath.startsWith(`${normalizedPublic}\\`) &&
      !normalizedPath.startsWith(`${normalizedPublic}/`),
    500,
    "STORAGE_ERROR",
    "Kho tài liệu phải nằm ngoài thư mục public.",
  );

  mkdirSync(path, { recursive: true, mode: 0o700 });
  assert(!lstatSync(path).isSymbolicLink(), 500, "STORAGE_ERROR", "Thư mục lưu tệp không hợp lệ.");

  return realpathSync(path);
}

// ============================================================================
// Magic Byte Sniffing & Stream Parsing
// ============================================================================

/**
 * Validate file content against declared extension using binary magic bytes.
 * Supports PDF (%PDF- ... %%EOF), PNG ([137, 80, 78, 71, 13, 10, 26, 10] + IHDR),
 * and JPEG (0xFFD8 ... 0xFFD9).
 */
function detectFile(name, bytes) {
  const extension = extname(name).slice(1).toLowerCase();
  let contentType;

  if (
    extension === "pdf" &&
    bytes.subarray(0, 5).toString() === "%PDF-" &&
    bytes.subarray(-1024).includes(Buffer.from("%%EOF"))
  ) {
    contentType = "application/pdf";
  }

  if (
    extension === "png" &&
    bytes.length >= 33 &&
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
    bytes.subarray(12, 16).toString() === "IHDR"
  ) {
    contentType = "image/png";
  }

  if (
    ["jpg", "jpeg"].includes(extension) &&
    bytes.length >= 4 &&
    bytes[0] === 255 &&
    bytes[1] === 216 &&
    bytes[2] === 255 &&
    bytes.at(-2) === 255 &&
    bytes.at(-1) === 217
  ) {
    contentType = "image/jpeg";
  }

  assert(
    contentType,
    415,
    "UNSUPPORTED_FILE_TYPE",
    "Chỉ nhận file PDF, JPEG hoặc PNG có nội dung hợp lệ.",
  );

  return { extension, contentType };
}

/**
 * Safely parse a streaming multipart/form-data upload request.
 * Enforces bounded size limits, allowed form fields, required declaration,
 * and strict filename sanitization against path traversal.
 */
async function readUpload(request) {
  const contentType = request.headers["content-type"] || "";
  assert(
    /^multipart\/form-data;\s*boundary=/i.test(contentType),
    415,
    "UNSUPPORTED_MEDIA_TYPE",
    "Tải tệp bằng multipart/form-data.",
  );

  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    assert(
      size <= MAX_FACILITY_ATTACHMENT_BYTES + 32768,
      413,
      "FILE_TOO_LARGE",
      "Tệp tải lên vượt dung lượng cho phép.",
    );
    chunks.push(chunk);
  }

  let form;
  try {
    form = await new Request("http://localhost/upload", {
      method: "POST",
      headers: { "Content-Type": contentType },
      body: Buffer.concat(chunks),
    }).formData();
  } catch {
    throw new ApiError(400, "INVALID_UPLOAD", "Dữ liệu tải tệp không hợp lệ.");
  }

  const allowed = ["file", "documentType", "description", "personnelId", "permitted"];
  assert(
    [...form.keys()].every((key) => allowed.includes(key)) && form.getAll("file").length === 1,
    400,
    "INVALID_UPLOAD",
    "Dữ liệu tải tệp có trường không hợp lệ.",
  );

  assert(
    form.get("permitted") === "true",
    400,
    "INVALID_UPLOAD",
    "Phải xác nhận tài liệu được phép lưu trên hệ thống.",
  );

  const file = form.get("file");
  assert(file && typeof file.arrayBuffer === "function", 400, "INVALID_UPLOAD", "Chưa chọn tệp.");
  assert(
    file.size > 0 && file.size <= MAX_FACILITY_ATTACHMENT_BYTES,
    file.size > MAX_FACILITY_ATTACHMENT_BYTES ? 413 : 400,
    "FILE_TOO_LARGE",
    "Dung lượng tệp không hợp lệ.",
  );

  assert(
    file.name &&
      file.name.length <= 200 &&
      basename(file.name) === file.name &&
      !/[\\/\x00-\x1f\x7f]/.test(file.name) &&
      ![".", ".."].includes(file.name),
    400,
    "INVALID_FILE",
    "Tên tệp không hợp lệ.",
  );

  return {
    name: file.name,
    bytes: Buffer.from(await file.arrayBuffer()),
    documentType: trimmed(form.get("documentType"), "Loại tài liệu", 1, 100),
    description: nullableText(form.get("description"), "Mô tả", 1000) ?? "",
    personnelId: nullableText(form.get("personnelId"), "Nhân sự", 128),
  };
}

// ============================================================================
// Public Attachment Services (UC-FAC-06)
// ============================================================================

/**
 * List attachments associated with a facility (optionally linked to personnel),
 * sorted newest first, with pagination.
 */
export function listFacilityAttachments(db, user, facilityId, url) {
  getFacility(db, user, facilityId);
  const { page, pageSize } = pagination(url);

  const items = db
    .prepare(
      `SELECT ${attachmentColumns}
       FROM attachments a
       LEFT JOIN facility_personnel p ON p.id = a.personnel_id
       JOIN accounts u ON u.id = a.uploaded_by
       WHERE a.facility_id = ?
       ORDER BY a.uploaded_at DESC, a.id DESC
       LIMIT ? OFFSET ?`,
    )
    .all(facilityId, pageSize, (page - 1) * pageSize);

  const total = db
    .prepare(`SELECT count(*) AS n FROM attachments WHERE facility_id = ?`)
    .get(facilityId).n;

  return {
    items,
    total,
    page,
    pageSize,
    maxFileBytes: MAX_FACILITY_ATTACHMENT_BYTES,
    allowedExtensions: ["pdf", "jpg", "jpeg", "png"],
  };
}

/**
 * Upload an attachment to a facility.
 * Enforces M03.edit permissions, re-authorizes before disk write (in case session changed during stream),
 * writes the file exclusively with 0o600 mode, commits database transaction and audit log,
 * and unlinks file if database insert fails.
 *
 * @param {import("node:sqlite").DatabaseSync} db
 * @param {object} user
 * @param {string} facilityId
 * @param {import("node:http").IncomingMessage} request
 * @param {string} ip
 * @param {string} [directory]
 * @param {() => object} [refreshPrincipal] Callback to refresh session principal after upload finishes
 */
export async function uploadFacilityAttachment(
  db,
  user,
  facilityId,
  request,
  ip,
  directory,
  refreshPrincipal = () => user,
) {
  requirePermission(user, "M03.edit");
  getFacility(db, user, facilityId);

  const upload = await readUpload(request);

  // A streamed upload can outlive a session/grant change; authorize again before writing anything.
  const currentUser = refreshPrincipal();
  requirePermission(currentUser, "M03.edit");
  getFacility(db, currentUser, facilityId);

  const detected = detectFile(upload.name, upload.bytes);
  if (upload.personnelId) {
    assert(
      personnelRow(db, facilityId, upload.personnelId),
      400,
      "INVALID_INPUT",
      "Nhân sự được liên kết không thuộc cơ sở này.",
    );
  }

  const id = randomUUID();
  const storedName = `${id}.${detected.extension}`;
  const root = storageRoot(directory);
  const path = join(root, storedName);
  let created = false;

  try {
    const descriptor = openSync(path, "wx", 0o600);
    created = true;
    try {
      writeFileSync(descriptor, upload.bytes);
      fsyncSync(descriptor);
    } finally {
      closeSync(descriptor);
    }

    return transaction(db, () => {
      const now = Date.now();
      db.prepare(
        `INSERT INTO attachments (
           id, facility_id, personnel_id, document_type, description,
           original_name, stored_name, content_type, size_bytes,
           storage_path, uploaded_by, uploaded_at
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        id,
        facilityId,
        upload.personnelId,
        upload.documentType,
        upload.description,
        upload.name,
        storedName,
        detected.contentType,
        upload.bytes.length,
        storedName,
        currentUser.id,
        now,
      );

      const attachment = db
        .prepare(
          `SELECT ${attachmentColumns}
           FROM attachments a
           LEFT JOIN facility_personnel p ON p.id = a.personnel_id
           JOIN accounts u ON u.id = a.uploaded_by
           WHERE a.id = ?`,
        )
        .get(id);

      writeAudit(db, {
        actorId: currentUser.id,
        feature: "M03",
        objectType: "facility_attachment",
        objectId: id,
        action: "facility.attachment_uploaded",
        after: attachment,
        ip,
      });

      return { attachment };
    });
  } catch (error) {
    if (created) {
      try {
        unlinkSync(path);
      } catch {
        // Preserve the original storage/database error.
      }
    }
    throw error;
  }
}

/**
 * Retrieve raw attachment file content along with metadata for inline viewing or download.
 * Validates safe storage path, ensures regular file (no symlinks), and verifies byte length.
 */
export function facilityAttachmentFile(db, user, facilityId, attachmentId, directory) {
  getFacility(db, user, facilityId);

  const attachment = db
    .prepare("SELECT * FROM attachments WHERE id = ? AND facility_id = ?")
    .get(attachmentId, facilityId);

  assert(attachment, 404, "NOT_FOUND", "Không tìm thấy tài liệu trong cơ sở này.");
  assert(
    /^[a-f0-9-]+\.(pdf|png|jpg|jpeg)$/.test(attachment.storage_path) &&
      attachment.storage_path === attachment.stored_name,
    500,
    "STORAGE_ERROR",
    "Thông tin lưu trữ tài liệu không hợp lệ.",
  );

  const path = join(storageRoot(directory), attachment.storage_path);
  let bytes;

  try {
    const stat = lstatSync(path);
    assert(
      stat.isFile() && !stat.isSymbolicLink(),
      410,
      "DOCUMENT_MISSING",
      "Tệp không còn trong kho lưu trữ.",
    );
    bytes = readFileSync(path);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(410, "DOCUMENT_MISSING", "Tệp không còn trong kho lưu trữ.");
  }

  assert(
    bytes.length === attachment.size_bytes,
    410,
    "DOCUMENT_MISSING",
    "Dung lượng tệp không khớp metadata.",
  );

  return { attachment, bytes };
}
