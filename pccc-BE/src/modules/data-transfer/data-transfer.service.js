import { randomUUID } from "node:crypto";
import { assert } from "../../core/errors.js";
import { foldSearchText, transaction } from "../../core/database.js";
import { officerScope } from "../../core/organization.js";
import { object, pagination, text } from "../../core/validation.js";
import {
  facilityScope,
  regionScope,
  requirePermission,
} from "../authorization/authorization.service.js";
import { writeAudit } from "../audit/audit.service.js";

const MAX_EXPORT_RECORDS = 100000;
const DATASETS = [
  { id: "facilities", label: "Cơ sở PCCC", module: "M03" },
  { id: "officers", label: "Cán bộ", module: "M02" },
  { id: "regions", label: "Khu vực / khu phố", module: "M02" },
];
const TRANSFER_STATUSES = new Set([
  "validating",
  "preview_ready",
  "importing",
  "succeeded",
  "partial",
  "failed",
]);
const FACILITY_STATUSES = new Set(["active", "paused", "suspended", "unlicensed"]);
const OFFICER_STATUSES = new Set(["ACTIVE", "INACTIVE", "TRANSFERRED"]);
const CSV_COLUMNS = {
  facilities: [
    "Mã cơ sở",
    "Tên cơ sở",
    "Địa chỉ",
    "Trạng thái",
    "Mã khu phố",
    "Khu phố",
    "Đơn vị",
    "Mã cán bộ",
    "Cán bộ phụ trách",
  ],
  officers: [
    "Mã cán bộ",
    "Họ và tên",
    "Cấp bậc",
    "Chức vụ",
    "Đơn vị",
    "Vai trò",
    "Trạng thái",
    "Khu vực phụ trách",
    "Số cơ sở trong phạm vi",
  ],
  regions: ["Mã khu phố", "Khu phố", "Mã đơn vị", "Đơn vị", "Số cơ sở"],
};

function hasAllScope(user) {
  return user.scopes.some((scope) => scope.kind === "all");
}

function canExport(user, dataset) {
  return (
    !user.mustChangePassword &&
    user.scopes.length > 0 &&
    user.permissions.includes(`${dataset.module}.view`) &&
    user.permissions.includes(`${dataset.module}.export`)
  );
}

function requireDatasetExport(user, datasetId) {
  const dataset = DATASETS.find((item) => item.id === datasetId);
  assert(dataset, 400, "INVALID_INPUT", "Loại dữ liệu xuất không hợp lệ.");
  requirePermission(user, `${dataset.module}.view`);
  requirePermission(user, `${dataset.module}.export`);
  assert(user.scopes.length > 0, 403, "FORBIDDEN", "Tài khoản chưa được phân phạm vi dữ liệu.");
  return dataset;
}

async function regionOptions(db, user) {
  const scope = regionScope(user);
  return (
    await db
      .prepare(
        `SELECT r.id,r.name,u.name AS unit_name FROM regions r
      JOIN units u ON u.id=r.unit_id WHERE ${scope.sql} ORDER BY u.name,r.name,r.id`,
      )
      .all(...scope.params)
  ).map((row) => ({ value: row.id, label: `${row.name} · ${row.unit_name}` }));
}

async function unitOptions(db, user) {
  const scope = regionScope(user);
  return (
    await db
      .prepare(
        `SELECT DISTINCT u.id,u.name FROM regions r JOIN units u ON u.id=r.unit_id
      WHERE ${scope.sql} ORDER BY u.name,u.id`,
      )
      .all(...scope.params)
  ).map((row) => ({ value: row.id, label: row.name }));
}

async function filterMetadata(db, user, datasetId) {
  if (datasetId === "facilities") {
    const scope = facilityScope(user);
    const statuses = (
      await db
        .prepare(`SELECT DISTINCT f.status FROM facilities f WHERE ${scope.sql} ORDER BY f.status`)
        .all(...scope.params)
    ).map((row) => ({ value: row.status, label: row.status }));
    return { regions: await regionOptions(db, user), statuses };
  }
  if (datasetId === "officers")
    return {
      regions: await regionOptions(db, user),
      statuses: [...OFFICER_STATUSES].map((value) => ({ value, label: value })),
    };
  return { units: await unitOptions(db, user) };
}

export async function listExportDatasets(db, user) {
  const items = await Promise.all(
    DATASETS.filter((dataset) => canExport(user, dataset)).map(async (dataset) => ({
      id: dataset.id,
      label: dataset.label,
      formats: ["csv"],
      filters: await filterMetadata(db, user, dataset.id),
    })),
  );
  assert(items.length > 0, 403, "FORBIDDEN", "Bạn chưa được cấp quyền xuất bộ dữ liệu nào.");
  return { items };
}

function optionalFilter(filters, key, max = 100) {
  const value = filters[key];
  if (value == null || value === "") return "";
  return text(value, key, 1, max).trim();
}

function validateFilters(datasetId, rawFilters) {
  object(rawFilters, ["search", "regionId", "unitId", "status"]);
  const filters = {
    search: optionalFilter(rawFilters, "search"),
    regionId: optionalFilter(rawFilters, "regionId"),
    unitId: optionalFilter(rawFilters, "unitId"),
    status: optionalFilter(rawFilters, "status", 32),
  };
  assert(
    datasetId === "regions" || !filters.unitId,
    400,
    "INVALID_INPUT",
    "Bộ lọc đơn vị chỉ áp dụng cho khu vực/khu phố.",
  );
  assert(
    datasetId !== "regions" || !filters.regionId,
    400,
    "INVALID_INPUT",
    "Bộ lọc khu vực không áp dụng cho danh sách khu vực/khu phố.",
  );
  assert(
    datasetId !== "regions" || !filters.status,
    400,
    "INVALID_INPUT",
    "Bộ lọc trạng thái không áp dụng cho danh sách khu vực/khu phố.",
  );
  if (filters.status) {
    const values = datasetId === "facilities" ? FACILITY_STATUSES : OFFICER_STATUSES;
    assert(values.has(filters.status), 400, "INVALID_INPUT", "Trạng thái lọc không hợp lệ.");
  }
  return filters;
}

async function facilityRows(db, user, filters) {
  const scope = facilityScope(user);
  const clauses = [scope.sql];
  const params = [...scope.params];
  if (filters.search) {
    clauses.push(
      "(instr(fold(f.name),?)>0 OR instr(fold(f.address),?)>0 OR instr(fold(f.id),?)>0)",
    );
    const q = foldSearchText(filters.search);
    params.push(q, q, q);
  }
  if (filters.regionId) {
    clauses.push("f.region_id=?");
    params.push(filters.regionId);
  }
  if (filters.status) {
    clauses.push("f.status=?");
    params.push(filters.status);
  }
  return await db
    .prepare(
      `SELECT f.id AS "Mã cơ sở",f.name AS "Tên cơ sở",f.address AS "Địa chỉ",
      f.status AS "Trạng thái",r.id AS "Mã khu phố",r.name AS "Khu phố",
      u.name AS "Đơn vị",f.officer_id AS "Mã cán bộ",o.full_name AS "Cán bộ phụ trách"
      FROM facilities f JOIN regions r ON r.id=f.region_id
      JOIN units u ON u.id=r.unit_id
      LEFT JOIN officer_directory o ON o.officer_id=f.officer_id
      WHERE ${clauses.join(" AND ")} ORDER BY r.name,f.name,f.id LIMIT ?`,
    )
    .all(...params, MAX_EXPORT_RECORDS + 1);
}

async function officerRows(db, user, filters) {
  const officers = officerScope(user);
  const facilities = facilityScope(user);
  const clauses = [officers.sql];
  const scopedFacilities = `f.officer_id=o.id AND ${facilities.sql}${filters.regionId ? " AND f.region_id=?" : ""}`;
  const facilityParams = [...facilities.params, ...(filters.regionId ? [filters.regionId] : [])];
  const params = [...facilityParams, ...facilityParams, ...officers.params];
  if (filters.search) {
    clauses.push(
      "(instr(fold(o.full_name),?)>0 OR instr(fold(o.officer_code),?)>0 OR instr(fold(o.position),?)>0 OR instr(fold(u.name),?)>0)",
    );
    const q = foldSearchText(filters.search);
    params.push(q, q, q, q);
  }
  if (filters.regionId) {
    clauses.push(`EXISTS (SELECT 1 FROM facilities f WHERE ${scopedFacilities})`);
    params.push(...facilityParams);
  }
  if (filters.status) {
    clauses.push("o.status=?");
    params.push(filters.status);
  }
  return await db
    .prepare(
      `SELECT o.officer_code AS "Mã cán bộ",o.full_name AS "Họ và tên",
      o.rank AS "Cấp bậc",o.position AS "Chức vụ",u.name AS "Đơn vị",
      o.business_role AS "Vai trò",o.status AS "Trạng thái",
      (SELECT string_agg(DISTINCT r.name, ',') FROM facilities f JOIN regions r ON r.id=f.region_id
        WHERE ${scopedFacilities}) AS "Khu vực phụ trách",
      (SELECT count(*) FROM facilities f WHERE ${scopedFacilities})
        AS "Số cơ sở trong phạm vi"
      FROM officers o JOIN units u ON u.id=o.unit_id
      WHERE ${clauses.join(" AND ")} ORDER BY o.full_name,o.id LIMIT ?`,
    )
    .all(...params, MAX_EXPORT_RECORDS + 1);
}

async function regionRows(db, user, filters) {
  const scope = regionScope(user);
  const facilities = facilityScope(user);
  const clauses = [scope.sql];
  const params = [...facilities.params, ...scope.params];
  if (filters.search) {
    clauses.push("(instr(fold(r.name),?)>0 OR instr(fold(r.id),?)>0 OR instr(fold(u.name),?)>0)");
    const q = foldSearchText(filters.search);
    params.push(q, q, q);
  }
  if (filters.unitId) {
    clauses.push("r.unit_id=?");
    params.push(filters.unitId);
  }
  return await db
    .prepare(
      `SELECT r.id AS "Mã khu phố",r.name AS "Khu phố",u.id AS "Mã đơn vị",
      u.name AS "Đơn vị",(SELECT count(*) FROM facilities f WHERE f.region_id=r.id AND ${facilities.sql}) AS "Số cơ sở"
      FROM regions r JOIN units u ON u.id=r.unit_id
      WHERE ${clauses.join(" AND ")} ORDER BY u.name,r.name,r.id LIMIT ?`,
    )
    .all(...params, MAX_EXPORT_RECORDS + 1);
}

function csvCell(value) {
  if (value == null) return '""';
  let cell = String(value);
  if (typeof value === "string" && /^[\t\r ]*[=+@-]/.test(cell)) cell = `'${cell}`;
  return `"${cell.replaceAll('"', '""')}"`;
}

function toCsv(rows, datasetId) {
  const columns = CSV_COLUMNS[datasetId];
  const lines = [columns, ...rows.map((row) => columns.map((column) => row[column]))]
    .map((line) => line.map(csvCell).join(","))
    .join("\r\n");
  return `\uFEFF${lines}\r\n`;
}

async function jobView(db, id) {
  return await db
    .prepare(
      `SELECT j.id,j.direction,j.dataset_id,j.file_name,j.file_format,j.status,j.filters_json,
      j.total_records,j.successful_records,j.error_count,j.error_summary,j.actor_id,
      a.full_name AS actor_name,j.created_at,j.completed_at
      FROM data_transfer_jobs j JOIN accounts a ON a.id=j.actor_id WHERE j.id=?`,
    )
    .get(id);
}

export async function recordTransferJob(db, actorId, input, ip) {
  object(input, [
    "direction",
    "datasetId",
    "fileName",
    "format",
    "status",
    "filters",
    "totalRecords",
    "successfulRecords",
    "errorCount",
    "errorSummary",
    "startedAt",
    "completedAt",
  ]);
  assert(
    ["import", "export"].includes(input.direction),
    400,
    "INVALID_INPUT",
    "Chiều truyền dữ liệu không hợp lệ.",
  );
  text(input.datasetId, "Loại dữ liệu", 1, 80);
  text(input.fileName, "Tên file", 1, 180);
  assert(
    ["csv", "xlsx"].includes(input.format),
    400,
    "INVALID_INPUT",
    "Định dạng file không hợp lệ.",
  );
  assert(
    TRANSFER_STATUSES.has(input.status),
    400,
    "INVALID_INPUT",
    "Trạng thái truyền dữ liệu không hợp lệ.",
  );
  const counts = [input.totalRecords, input.successfulRecords, input.errorCount];
  assert(
    counts.every((n) => Number.isSafeInteger(n) && n >= 0),
    400,
    "INVALID_INPUT",
    "Số lượng bản ghi không hợp lệ.",
  );
  assert(
    input.successfulRecords + input.errorCount <= input.totalRecords,
    400,
    "INVALID_INPUT",
    "Tổng số bản ghi không khớp.",
  );
  const filters = input.filters ?? {};
  object(filters, ["search", "regionId", "unitId", "status"]);
  const errorSummary =
    input.errorSummary == null ? null : text(input.errorSummary, "Mô tả lỗi", 1, 1000);
  const id = randomUUID();
  const createdAt = Number.isSafeInteger(input.startedAt) ? input.startedAt : Date.now();
  const completedAt = Number.isSafeInteger(input.completedAt) ? input.completedAt : Date.now();
  await transaction(db, async () => {
    await db
      .prepare(
        `INSERT INTO data_transfer_jobs(id,direction,dataset_id,file_name,file_format,status,
      filters_json,total_records,successful_records,error_count,error_summary,actor_id,created_at,completed_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        id,
        input.direction,
        input.datasetId,
        input.fileName,
        input.format,
        input.status,
        JSON.stringify(filters),
        input.totalRecords,
        input.successfulRecords,
        input.errorCount,
        errorSummary,
        actorId,
        createdAt,
        completedAt,
      );
    await writeAudit(db, {
      actorId,
      feature: "M11.data-transfer",
      objectType: "data_transfer_job",
      objectId: id,
      action: `data_transfer.${input.direction}.${input.status}`,
      after: {
        datasetId: input.datasetId,
        fileName: input.fileName,
        format: input.format,
        status: input.status,
        totalRecords: input.totalRecords,
        successfulRecords: input.successfulRecords,
        errorCount: input.errorCount,
      },
      ip,
    });
  });
  return await jobView(db, id);
}

export async function exportDataset(db, user, payload, ip) {
  object(payload, ["dataset", "format", "filters"]);
  const dataset = requireDatasetExport(user, text(payload.dataset, "Loại dữ liệu", 1, 80));
  const format = text(payload.format, "Định dạng file", 1, 10);
  assert(format === "csv", 400, "INVALID_INPUT", "Hiện chỉ hỗ trợ xuất CSV.");
  const filters = validateFilters(dataset.id, payload.filters ?? {});
  const startedAt = Date.now();
  const query =
    dataset.id === "facilities"
      ? facilityRows
      : dataset.id === "officers"
        ? officerRows
        : regionRows;
  let rows;
  let csv;
  try {
    rows = await query(db, user, filters);
    assert(
      rows.length <= MAX_EXPORT_RECORDS,
      413,
      "EXPORT_TOO_LARGE",
      "Kết quả vượt giới hạn 100.000 dòng; hãy thu hẹp bộ lọc.",
    );
    csv = toCsv(rows, dataset.id);
  } catch (error) {
    await recordTransferJob(
      db,
      user.id,
      {
        direction: "export",
        datasetId: dataset.id,
        fileName: `${dataset.id}-failed.csv`,
        format,
        status: "failed",
        filters,
        totalRecords: rows?.length ?? 0,
        successfulRecords: 0,
        errorCount: 0,
        errorSummary:
          error.code === "EXPORT_TOO_LARGE" ? error.message : "Không thể tạo file xuất.",
        startedAt,
        completedAt: Date.now(),
      },
      ip,
    );
    throw error;
  }
  const fileName = `${dataset.id}-${new Date(startedAt).toISOString().replaceAll(/[:.]/g, "-")}.csv`;
  const job = await recordTransferJob(
    db,
    user.id,
    {
      direction: "export",
      datasetId: dataset.id,
      fileName,
      format,
      status: "succeeded",
      filters,
      totalRecords: rows.length,
      successfulRecords: rows.length,
      errorCount: 0,
      startedAt,
      completedAt: Date.now(),
    },
    ip,
  );
  return { fileName, csv, job };
}

function canViewAllJobs(user) {
  return user.role === "A05" && user.permissions.includes("M01.view") && hasAllScope(user);
}

function requireTransferHistoryAccess(user) {
  assert(
    !user.mustChangePassword,
    403,
    "PASSWORD_CHANGE_REQUIRED",
    "Bạn cần đổi mật khẩu trước khi tiếp tục.",
  );
  if (canViewAllJobs(user)) return true;
  const dataset = DATASETS.find((item) => canExport(user, item));
  assert(dataset, 403, "FORBIDDEN", "Bạn không có quyền xem lịch sử truyền dữ liệu.");
  requirePermission(user, `${dataset.module}.view`);
  requirePermission(user, `${dataset.module}.export`);
  return false;
}

export async function listTransferJobs(db, user, url) {
  const all = requireTransferHistoryAccess(user);
  const { page, pageSize } = pagination(url);
  const clauses = [];
  const params = [];
  if (!all) {
    clauses.push("j.actor_id=?");
    params.push(user.id);
  }
  for (const [key, column] of [
    ["direction", "j.direction"],
    ["dataset", "j.dataset_id"],
    ["status", "j.status"],
  ]) {
    const value = url.searchParams.get(key);
    if (!value) continue;
    text(value, key, 1, 80);
    if (key === "direction")
      assert(
        ["import", "export"].includes(value),
        400,
        "INVALID_INPUT",
        "Chiều truyền dữ liệu không hợp lệ.",
      );
    if (key === "status")
      assert(
        TRANSFER_STATUSES.has(value),
        400,
        "INVALID_INPUT",
        "Trạng thái truyền dữ liệu không hợp lệ.",
      );
    if (key === "dataset")
      assert(
        DATASETS.some((dataset) => dataset.id === value),
        400,
        "INVALID_INPUT",
        "Loại dữ liệu không hợp lệ.",
      );
    clauses.push(`${column}=?`);
    params.push(value);
  }
  const where = clauses.length ? clauses.join(" AND ") : "1=1";
  return {
    items: await db
      .prepare(
        `SELECT j.id,j.direction,j.dataset_id,j.file_name,j.file_format,j.status,j.filters_json,
        j.total_records,j.successful_records,j.error_count,j.error_summary,j.actor_id,
        a.full_name AS actor_name,j.created_at,j.completed_at
        FROM data_transfer_jobs j JOIN accounts a ON a.id=j.actor_id WHERE ${where}
        ORDER BY j.created_at DESC,j.id DESC LIMIT ? OFFSET ?`,
      )
      .all(...params, pageSize, (page - 1) * pageSize),
    total: (
      await db
        .prepare(`SELECT count(*) AS total FROM data_transfer_jobs j WHERE ${where}`)
        .get(...params)
    ).total,
    page,
    pageSize,
  };
}

export async function transferJobDetail(db, user, id) {
  const all = requireTransferHistoryAccess(user);
  const job = await db
    .prepare(
      `SELECT j.id,j.direction,j.dataset_id,j.file_name,j.file_format,j.status,j.filters_json,
      j.total_records,j.successful_records,j.error_count,j.error_summary,j.actor_id,
      a.full_name AS actor_name,j.created_at,j.completed_at
      FROM data_transfer_jobs j JOIN accounts a ON a.id=j.actor_id WHERE j.id=?${all ? "" : " AND j.actor_id=?"}`,
    )
    .get(...(all ? [id] : [id, user.id]));
  assert(job, 404, "NOT_FOUND", "Không tìm thấy lịch sử truyền dữ liệu.");
  return {
    job,
    errors: await db
      .prepare(
        "SELECT row_number,field_name,error_code,message,created_at FROM data_transfer_errors WHERE job_id=? ORDER BY row_number,id",
      )
      .all(id),
  };
}
