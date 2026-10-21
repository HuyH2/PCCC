import { randomUUID } from "node:crypto";

import { assert } from "../../core/errors.js";
import { transaction } from "../../core/database.js";
import { businessDate } from "../../core/time.js";
import { object, pagination, text } from "../../core/validation.js";
import {
  accountScope,
  facilityScope,
  regionScope,
  requirePermission,
} from "../authorization/authorization.service.js";
import { writeAudit } from "../audit/audit.service.js";
import { REPORT_DEFINITIONS } from "./catalog.js";
import { buildReportXlsx } from "./report-xlsx.js";
import { buildReportPdf } from "./report-pdf.js";

export const MAX_REPORT_ROWS = 5000;
export const MAX_REPORT_RANGE_DAYS = 5 * 366;
const REPORT_FORMATS = ["xlsx", "pdf"];
const numberFormatter = new Intl.NumberFormat("vi-VN");
const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const dateTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function requireReportAccess(user, action = "view") {
  requirePermission(user, "M08.view");
  if (action !== "view") requirePermission(user, `M08.${action}`);
  assert(user.scopes.length > 0, 403, "FORBIDDEN", "Tài khoản chưa có phạm vi quản lý.");
}

async function activeReportType(db, idOrCode) {
  const row = await db
    .prepare("SELECT * FROM report_export_types WHERE is_active=1 AND (id=? OR code=?)")
    .get(idOrCode, idOrCode);
  assert(row, 404, "NOT_FOUND", "Loại báo cáo không tồn tại hoặc đã ngừng sử dụng.");
  const definition = REPORT_DEFINITIONS[row.code];
  assert(definition, 500, "CONFIGURATION", "Cấu hình loại báo cáo chưa đầy đủ.");
  return { row, definition };
}

function typeResponse(row, templateCount = 0, officialCount = 0) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    dataset_key: row.dataset_key,
    scope_kind: row.scope_kind,
    supports_period: Boolean(row.supports_period),
    supports_region: Boolean(row.supports_region),
    default_format: row.default_format,
    template_count: templateCount,
    official_template_count: officialCount,
  };
}

export async function listReportTypes(db, user) {
  requireReportAccess(user);
  const counts = new Map(
    (
      await db
        .prepare(
          `SELECT report_type_id,count(*) AS total,
          sum(is_official) AS official
        FROM report_templates WHERE is_active=1 GROUP BY report_type_id`,
        )
        .all()
    ).map((row) => [row.report_type_id, row]),
  );
  return {
    items: (
      await db.prepare("SELECT * FROM report_export_types WHERE is_active=1 ORDER BY code").all()
    ).map((row) => {
      const count = counts.get(row.id);
      return typeResponse(row, count?.total ?? 0, count?.official ?? 0);
    }),
    maxRows: MAX_REPORT_ROWS,
  };
}

function templateResponse(row) {
  let columnLabels = {};
  try {
    const parsed = JSON.parse(row.column_labels_json);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) columnLabels = parsed;
  } catch {
    columnLabels = {};
  }
  return {
    id: row.id,
    report_type_id: row.report_type_id,
    report_type_code: row.report_type_code ?? null,
    name: row.name,
    format: row.format,
    title: row.title,
    header_note: row.header_note,
    footer_note: row.footer_note,
    column_labels: columnLabels,
    is_official: Boolean(row.is_official),
    created_at: row.created_at,
  };
}

export async function listReportTemplates(db, user, url) {
  requireReportAccess(user);
  const reportTypeId = url.searchParams.get("reportTypeId");
  const clauses = ["t.is_active=1"];
  const params = [];
  if (reportTypeId) {
    text(reportTypeId, "Loại báo cáo", 1, 100);
    clauses.push("t.report_type_id=?");
    params.push(reportTypeId);
  }
  return {
    items: (
      await db
        .prepare(
          `SELECT t.*,r.code AS report_type_code
        FROM report_templates t JOIN report_export_types r ON r.id=t.report_type_id
        WHERE ${clauses.join(" AND ")}
        ORDER BY t.is_official DESC,t.created_at DESC,t.id`,
        )
        .all(...params)
    ).map(templateResponse),
  };
}

export async function createReportTemplate(db, user, input, ip) {
  requireReportAccess(user, "create");
  object(input, [
    "reportTypeId",
    "name",
    "format",
    "title",
    "headerNote",
    "footerNote",
    "columnLabels",
    "isOfficial",
  ]);
  const type = await activeReportType(db, text(input.reportTypeId, "Loại báo cáo", 1, 100));
  const name = text(
    typeof input.name === "string" ? input.name.trim() : input.name,
    "Tên biểu mẫu",
    1,
    200,
  );
  assert(
    REPORT_FORMATS.includes(input.format),
    400,
    "INVALID_INPUT",
    "Định dạng biểu mẫu không hợp lệ.",
  );
  const title =
    input.title === undefined
      ? ""
      : text(
          typeof input.title === "string" ? input.title.trim() : input.title,
          "Tiêu đề biểu mẫu",
          0,
          300,
        );
  const headerNote =
    input.headerNote === undefined
      ? ""
      : text(
          typeof input.headerNote === "string" ? input.headerNote.trim() : input.headerNote,
          "Ghi chú đầu báo cáo",
          0,
          1000,
        );
  const footerNote =
    input.footerNote === undefined
      ? ""
      : text(
          typeof input.footerNote === "string" ? input.footerNote.trim() : input.footerNote,
          "Ghi chú cuối báo cáo",
          0,
          1000,
        );
  const allowedKeys = new Set(type.definition.columns.map((column) => column.key));
  const labels = {};
  if (input.columnLabels !== undefined) {
    object(input.columnLabels, [...allowedKeys]);
    for (const [key, value] of Object.entries(input.columnLabels)) {
      labels[key] = text(
        typeof value === "string" ? value.trim() : value,
        `Nhãn cột ${key}`,
        1,
        100,
      );
    }
  }
  const now = Date.now();
  const id = randomUUID();
  await transaction(db, async () => {
    await db
      .prepare(
        `INSERT INTO report_templates
      (id,report_type_id,name,format,title,header_note,footer_note,column_labels_json,
       is_official,is_active,created_by,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,1,?,?,?)`,
      )
      .run(
        id,
        type.row.id,
        name,
        input.format,
        title,
        headerNote,
        footerNote,
        JSON.stringify(labels),
        input.isOfficial === true ? 1 : 0,
        user.id,
        now,
        now,
      );
    await writeAudit(db, {
      actorId: user.id,
      feature: "M08",
      objectType: "report_template",
      objectId: id,
      action: "report_template.created",
      after: {
        reportTypeId: type.row.id,
        name,
        format: input.format,
        official: input.isOfficial === true,
      },
      ip,
    });
  });
  return templateResponse(
    await db
      .prepare(
        `SELECT t.*,r.code AS report_type_code
        FROM report_templates t JOIN report_export_types r ON r.id=t.report_type_id WHERE t.id=?`,
      )
      .get(id),
  );
}

export async function reportOptions(db, user) {
  requireReportAccess(user);
  const regionFilter = regionScope(user);
  const facilityFilter = facilityScope(user);
  const accountFilter = accountScope(user);
  const today = businessDate();
  return {
    regions: await db
      .prepare(`SELECT r.id,r.name FROM regions r WHERE ${regionFilter.sql} ORDER BY r.name,r.id`)
      .all(...regionFilter.params),
    facility_officers: await db
      .prepare(
        `SELECT o.officer_id AS id,o.full_name AS name,count(*) AS facility_count
        FROM facility_overview f
        JOIN officer_directory o ON o.officer_id=f.officer_id
        WHERE ${facilityFilter.sql}
        GROUP BY o.officer_id,o.full_name
        ORDER BY o.full_name,o.officer_id`,
      )
      .all(...facilityFilter.params),
    account_officers: await db
      .prepare(
        `SELECT a.id,a.full_name AS name,a.username
        FROM accounts a
        WHERE a.status='active' AND ${accountFilter.sql}
        ORDER BY a.full_name,a.id`,
      )
      .all(...accountFilter.params),
    formats: [
      { value: "xlsx", label: "Excel (XLSX)" },
      { value: "pdf", label: "PDF" },
    ],
    defaults: { from: `${today.slice(0, 8)}01`, to: today },
    maxRows: MAX_REPORT_ROWS,
  };
}

function optionalText(value, field, max = 100) {
  if (value === undefined || value === null || value === "") return null;
  return text(value, field, 1, max);
}

function parseReportDate(value, field) {
  assert(
    typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value),
    400,
    "INVALID_INPUT",
    `${field} phải có định dạng YYYY-MM-DD.`,
  );
  const parsed = new Date(`${value}T00:00:00+07:00`);
  assert(
    Number.isFinite(parsed.getTime()) && businessDate(parsed.getTime()) === value,
    400,
    "INVALID_INPUT",
    `${field} không hợp lệ.`,
  );
  return value;
}

function inputFromUrl(url) {
  return {
    reportTypeId: url.searchParams.get("reportTypeId") ?? url.searchParams.get("type") ?? "",
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    regionId: url.searchParams.get("regionId") ?? undefined,
    officerId: url.searchParams.get("officerId") ?? undefined,
    templateId: url.searchParams.get("templateId") ?? undefined,
    format: url.searchParams.get("format") ?? undefined,
  };
}

async function normalizeInput(db, user, input) {
  const type = await activeReportType(db, text(input.reportTypeId, "Loại báo cáo", 1, 100));
  const definition = type.definition;
  const format = input.format ?? type.row.default_format;
  assert(
    REPORT_FORMATS.includes(format),
    400,
    "INVALID_INPUT",
    "Định dạng xuất báo cáo không hợp lệ.",
  );

  let from = null;
  let to = null;
  let fromStart = null;
  let toExclusive = null;
  if (definition.supportsPeriod) {
    const today = businessDate();
    from = parseReportDate(input.from ?? `${today.slice(0, 8)}01`, "Từ ngày");
    to = parseReportDate(input.to ?? today, "Đến ngày");
    fromStart = Date.parse(`${from}T00:00:00+07:00`);
    toExclusive = Date.parse(`${to}T00:00:00+07:00`) + 86400000;
    assert(from <= to, 400, "INVALID_INPUT", "Từ ngày phải trước hoặc bằng đến ngày.");
    assert(
      toExclusive - fromStart <= MAX_REPORT_RANGE_DAYS * 86400000,
      400,
      "INVALID_INPUT",
      `Khoảng thời gian tối đa ${MAX_REPORT_RANGE_DAYS} ngày.`,
    );
  } else {
    assert(
      (input.from === undefined || input.from === null || input.from === "") &&
        (input.to === undefined || input.to === null || input.to === ""),
      400,
      "INVALID_INPUT",
      "Báo cáo này không hỗ trợ lọc theo thời gian.",
    );
  }

  const regionId = optionalText(input.regionId, "Khu vực");
  assert(
    !regionId || definition.supportsRegion,
    400,
    "INVALID_INPUT",
    "Báo cáo này không hỗ trợ lọc theo khu vực.",
  );
  const officerId = optionalText(input.officerId, "Cán bộ");
  const templateId = optionalText(input.templateId, "Biểu mẫu");
  let regionName = null;
  let officerName = null;

  if (regionId) {
    const filter = regionScope(user);
    const region = await db
      .prepare(`SELECT r.name FROM regions r WHERE r.id=? AND ${filter.sql}`)
      .get(regionId, ...filter.params);
    assert(region, 403, "FORBIDDEN", "Khu vực không thuộc phạm vi dữ liệu được cấp.");
    regionName = region.name;
  }
  if (officerId) {
    if (definition.scope === "account") {
      const filter = accountScope(user);
      const officer = await db
        .prepare(`SELECT a.full_name AS name FROM accounts a WHERE a.id=? AND ${filter.sql}`)
        .get(officerId, ...filter.params);
      assert(officer, 403, "FORBIDDEN", "Cán bộ không thuộc phạm vi dữ liệu được cấp.");
      officerName = officer.name;
    } else {
      const filter = facilityScope(user);
      const officer = await db
        .prepare(
          `SELECT o.full_name AS name FROM facility_overview f
          JOIN officer_directory o ON o.officer_id=f.officer_id
          WHERE f.officer_id=? AND ${filter.sql} LIMIT 1`,
        )
        .get(officerId, ...filter.params);
      assert(officer, 403, "FORBIDDEN", "Cán bộ không thuộc phạm vi dữ liệu được cấp.");
      officerName = officer.name;
    }
  }

  let template = null;
  if (templateId) {
    const row = await db
      .prepare(
        `SELECT t.*,r.code AS report_type_code FROM report_templates t
        JOIN report_export_types r ON r.id=t.report_type_id
        WHERE t.id=? AND t.report_type_id=? AND t.is_active=1`,
      )
      .get(templateId, type.row.id);
    assert(row, 404, "NOT_FOUND", "Biểu mẫu không tồn tại hoặc không áp dụng cho báo cáo này.");
    assert(
      row.format === format,
      409,
      "TEMPLATE_FORMAT_MISMATCH",
      "Định dạng file không khớp với biểu mẫu đã chọn.",
    );
    template = row;
  }

  const filters = {
    from,
    to,
    regionId,
    regionName,
    officerId,
    officerName,
    templateId,
  };
  return {
    type,
    definition,
    format,
    from,
    to,
    fromStart,
    toExclusive,
    regionId,
    officerId,
    template,
    filters,
  };
}

function buildWhere(user, normalized) {
  const { definition, from, to, fromStart, toExclusive, regionId, officerId } = normalized;
  const scope = definition.scope === "account" ? accountScope(user) : facilityScope(user);
  const clauses = [scope.sql];
  const params = [...scope.params];
  if (regionId) {
    clauses.push("f.region_id=?");
    params.push(regionId);
  }
  if (officerId) {
    clauses.push(definition.scope === "account" ? "a.id=?" : "f.officer_id=?");
    params.push(officerId);
  }
  if (from !== null) {
    if (definition.dataset === "inspections") {
      clauses.push("i.scheduled_date BETWEEN ? AND ?");
      params.push(from, to);
    } else if (definition.dataset === "violations") {
      clauses.push("v.suspension_at>=? AND v.suspension_at<?");
      params.push(fromStart, toExclusive);
    } else if (definition.dataset === "tasks") {
      clauses.push("t.created_at>=? AND t.created_at<?");
      params.push(fromStart, toExclusive);
    }
  }
  return { sql: clauses.join(" AND "), params };
}

async function fetchRows(db, user, normalized) {
  const { definition } = normalized;
  const where = buildWhere(user, normalized);
  const limit = MAX_REPORT_ROWS + 1;
  let sql;
  let params;
  if (definition.dataset === "facilities") {
    sql = `SELECT f.id,f.name,f.address,f.region_name,f.unit_name,f.officer_name,f.status
      FROM facility_overview f WHERE ${where.sql}
      ORDER BY f.region_name,f.name,f.id LIMIT ?`;
    params = [...where.params, limit];
  } else if (definition.dataset === "violations") {
    sql = `SELECT v.id,v.facility_id,f.name AS facility_name,f.region_name,v.description,
        v.suspension_decision_reference,v.suspension_at,v.status,
        v.restoration_decision_reference,v.approved_at
      FROM facility_violations v
      JOIN facility_overview f ON f.id=v.facility_id
      WHERE ${where.sql}
      ORDER BY v.suspension_at DESC,v.id DESC LIMIT ?`;
    params = [...where.params, limit];
  } else if (definition.dataset === "inspections") {
    sql = `SELECT i.id,i.code,i.facility_id,f.name AS facility_name,f.region_name,i.kind,
        i.scheduled_date,o.full_name AS lead_officer_name,
        CASE WHEN i.results_submitted_at IS NOT NULL AND i.status='in_progress'
          THEN 'evaluated' ELSE i.status END AS status,
        i.outcome
      FROM inspections i
      JOIN facility_overview f ON f.id=i.facility_id
      LEFT JOIN officer_directory o ON o.officer_id=i.lead_officer_id
      WHERE ${where.sql}
      ORDER BY i.scheduled_date DESC,i.code LIMIT ?`;
    params = [...where.params, limit];
  } else {
    sql = `SELECT a.id AS account_id,a.full_name,a.username,
        count(t.id) AS assigned_tasks,
        coalesce(sum(CASE WHEN t.status='completed' THEN 1 ELSE 0 END),0) AS completed_tasks,
        coalesce(sum(CASE WHEN t.status='open' THEN 1 ELSE 0 END),0) AS open_tasks,
        coalesce(sum(CASE WHEN t.status='open' AND t.due_at IS NOT NULL AND t.due_at<?
          THEN 1 ELSE 0 END),0) AS overdue_tasks,
        coalesce(sum(CASE WHEN t.kind='routine' THEN 1 ELSE 0 END),0) AS routine_tasks,
        coalesce(sum(CASE WHEN t.kind='unscheduled' THEN 1 ELSE 0 END),0) AS unscheduled_tasks,
        coalesce(sum(CASE WHEN t.kind='assigned' THEN 1 ELSE 0 END),0) AS assigned_kind_tasks
      FROM accounts a
      LEFT JOIN tasks t ON t.assigned_to=a.id
      WHERE a.status='active' AND ${where.sql}
      GROUP BY a.id
      HAVING count(t.id)>0
      ORDER BY a.full_name,a.id LIMIT ?`;
    params = [Date.now(), ...where.params, limit];
  }
  const rows = await db.prepare(sql).all(...params);
  assert(
    rows.length <= MAX_REPORT_ROWS,
    413,
    "REPORT_TOO_LARGE",
    `Báo cáo vượt quá ${MAX_REPORT_ROWS} dòng. Hãy thu hẹp bộ lọc.`,
  );
  if (definition.dataset === "tasks")
    for (const row of rows)
      row.completion_rate = row.assigned_tasks
        ? Math.round((row.completed_tasks * 100) / row.assigned_tasks)
        : 0;
  return rows;
}

function summaryItem(label, value, unit = "") {
  return { label, value, unit };
}

function buildSummary(definition, rows) {
  if (definition.dataset === "facilities") {
    const count = (status) => rows.filter((row) => row.status === status).length;
    return [
      summaryItem("Tổng số cơ sở", rows.length, "cơ sở"),
      summaryItem("Đang hoạt động", count("active")),
      summaryItem("Tạm dừng", count("paused")),
      summaryItem("Đình chỉ", count("suspended")),
      summaryItem("Không phép", count("unlicensed")),
    ];
  }
  if (definition.dataset === "violations") {
    return [
      summaryItem("Tổng số vụ vi phạm", rows.length, "vụ"),
      summaryItem("Đang đình chỉ", rows.filter((row) => row.status === "suspended").length),
      summaryItem("Đã khắc phục", rows.filter((row) => row.status === "restored").length),
    ];
  }
  if (definition.dataset === "inspections") {
    const count = (status) => rows.filter((row) => row.status === status).length;
    return [
      summaryItem("Tổng số cuộc kiểm tra", rows.length, "cuộc"),
      summaryItem("Đã lập kế hoạch", count("planned")),
      summaryItem("Đang thực hiện", count("in_progress")),
      summaryItem("Đã có kết quả", count("evaluated") + count("completed")),
      summaryItem("Đạt", rows.filter((row) => row.outcome === "pass").length),
      summaryItem("Không đạt", rows.filter((row) => row.outcome === "fail").length),
    ];
  }
  const totalTasks = rows.reduce((sum, row) => sum + row.assigned_tasks, 0);
  const completed = rows.reduce((sum, row) => sum + row.completed_tasks, 0);
  const open = rows.reduce((sum, row) => sum + row.open_tasks, 0);
  const overdue = rows.reduce((sum, row) => sum + row.overdue_tasks, 0);
  return [
    summaryItem("Số cán bộ có việc", rows.length, "cán bộ"),
    summaryItem("Tổng số công việc", totalTasks, "việc"),
    summaryItem("Hoàn thành", completed, "việc"),
    summaryItem("Đang mở", open, "việc"),
    summaryItem("Quá hạn", overdue, "việc"),
    summaryItem(
      "Tỷ lệ hoàn thành",
      totalTasks ? Math.round((completed * 100) / totalTasks) : 0,
      "%",
    ),
  ];
}

function columnsFor(definition, template) {
  let labels = {};
  if (template) {
    try {
      const parsed = JSON.parse(template.column_labels_json);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) labels = parsed;
    } catch {
      labels = {};
    }
  }
  return definition.columns.map((column) => ({
    ...column,
    label: labels[column.key] || column.label,
  }));
}

function formatDateValue(value, withTime) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-");
    return `${day}/${month}/${year}`;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return (withTime ? dateTimeFormatter : dateFormatter).format(date);
}

function displayValue(value, column) {
  if (value === null || value === undefined || value === "") return "—";
  if (column.labels) return column.labels(value) ?? String(value);
  if (column.format === "date") return formatDateValue(value, false);
  if (column.format === "datetime") return formatDateValue(value, true);
  if (column.suffix && typeof value === "number")
    return `${numberFormatter.format(value)}${column.suffix}`;
  if (column.numeric && typeof value === "number") return numberFormatter.format(value);
  return String(value);
}

function excelValue(value, column) {
  if (value === null || value === undefined || value === "") return "";
  if (column.numeric && typeof value === "number" && !column.suffix) return value;
  return displayValue(value, column);
}

function displayRows(rows, columns) {
  return rows.map((row) =>
    Object.fromEntries(
      columns.map((column) => [column.key, displayValue(row[column.key], column)]),
    ),
  );
}

async function buildReport(db, user, normalized) {
  const rows = await fetchRows(db, user, normalized);
  const columns = columnsFor(normalized.definition, normalized.template);
  return {
    rows,
    columns,
    summary: buildSummary(normalized.definition, rows),
    displayRows: displayRows(rows, columns),
  };
}

function reportTypePayload(type, template) {
  return {
    id: type.row.id,
    code: type.row.code,
    name: type.row.name,
    description: type.row.description,
    scope_kind: type.row.scope_kind,
    supports_period: Boolean(type.row.supports_period),
    supports_region: Boolean(type.row.supports_region),
    default_format: type.row.default_format,
    template: template ? templateResponse(template) : null,
  };
}

export async function previewReport(db, user, url) {
  requireReportAccess(user);
  const { page, pageSize } = pagination(url);
  const normalized = await normalizeInput(db, user, inputFromUrl(url));
  const built = await buildReport(db, user, normalized);
  const start = (page - 1) * pageSize;
  return {
    reportType: reportTypePayload(normalized.type, normalized.template),
    columns: built.columns.map(({ key, label, numeric, suffix }) => ({
      key,
      label,
      numeric: Boolean(numeric),
      suffix: suffix ?? "",
    })),
    rows: built.displayRows.slice(start, start + pageSize),
    total: built.rows.length,
    page,
    pageSize,
    maxRows: MAX_REPORT_ROWS,
    summary: built.summary,
    filters: normalized.filters,
    period: normalized.from === null ? null : { from: normalized.from, to: normalized.to },
    generatedAt: Date.now(),
  };
}

function exportFileName(type, format) {
  const date = businessDate().replaceAll("-", "");
  return `BC-${type.row.code}-${date}-${randomUUID().slice(0, 8).toUpperCase()}.${format}`;
}

async function exportHistoryRow(db, id) {
  return await db
    .prepare(
      `SELECT h.*,r.code AS report_type_code,r.name AS report_type_name,
        a.full_name AS exporter_name,a.username AS exporter_username
      FROM report_export_history h
      JOIN report_export_types r ON r.id=h.report_type_id
      JOIN accounts a ON a.id=h.exported_by
      WHERE h.id=?`,
    )
    .get(id);
}

function historyResponse(row) {
  let filters = {};
  try {
    const parsed = JSON.parse(row.filters_json);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) filters = parsed;
  } catch {
    filters = {};
  }
  return {
    id: row.id,
    report_type_id: row.report_type_id,
    report_type_code: row.report_type_code,
    report_type_name: row.report_type_name,
    template_id: row.template_id,
    template_name: row.template_name,
    format: row.format,
    file_name: row.file_name,
    file_size: row.file_size,
    row_count: row.row_count,
    filters,
    period_start: row.period_start,
    period_end: row.period_end,
    exported_by: row.exported_by,
    exporter_name: row.exporter_name,
    exporter_username: row.exporter_username,
    exported_at: row.exported_at,
    status: row.status,
    error_message: row.error_message,
    download_url:
      row.status === "completed"
        ? `/api/report-export/exports/${encodeURIComponent(row.id)}/file`
        : null,
  };
}

export async function createReportExport(db, user, input, ip) {
  requireReportAccess(user, "export");
  object(input, ["reportTypeId", "from", "to", "regionId", "officerId", "templateId", "format"]);
  const normalized = await normalizeInput(db, user, input);
  const built = await buildReport(db, user, normalized);
  assert(built.rows.length > 0, 409, "EMPTY_REPORT", "Không có dữ liệu phù hợp để xuất báo cáo.");
  const { type, definition, format, template } = normalized;
  const now = Date.now();
  const requestId = randomUUID();
  const requestCode = `YC-${businessDate().replaceAll("-", "")}-${requestId
    .slice(0, 8)
    .toUpperCase()}`;
  const fileName = exportFileName(type, format);
  const filters = {
    ...normalized.filters,
    templateName: template?.name ?? null,
  };
  await transaction(db, async () => {
    await db
      .prepare(
        `INSERT INTO report_export_requests
      (id,code,report_type_id,requested_by,period_start,period_end,filters_json,status,created_at)
      VALUES (?,?,?,?,?,?,?,'processing',?)`,
      )
      .run(
        requestId,
        requestCode,
        type.row.id,
        user.id,
        normalized.from,
        normalized.to,
        JSON.stringify(filters),
        now,
      );
  });

  try {
    const file =
      format === "xlsx"
        ? buildReportXlsx({
            title: template?.title || definition.name,
            typeName: definition.name,
            typeCode: type.row.code,
            columns: built.columns,
            rows: built.rows.map((row) =>
              Object.fromEntries(
                built.columns.map((column) => [column.key, excelValue(row[column.key], column)]),
              ),
            ),
            summary: built.summary,
            filters,
            template,
            exporter: user.fullName,
            exportedAt: now,
          })
        : await buildReportPdf({
            title: template?.title || definition.name,
            typeName: definition.name,
            typeCode: type.row.code,
            columns: built.columns,
            rows: built.displayRows,
            summary: built.summary,
            filters,
            template,
            exporter: user.fullName,
            exportedAt: now,
          });
    const submissionId = randomUUID();
    const historyId = randomUUID();
    await transaction(db, async () => {
      await db
        .prepare(
          `INSERT INTO report_export_submissions
        (id,request_id,file_name,content_type,file_size,file_data,created_at)
        VALUES (?,?,?,?,?,?,?)`,
        )
        .run(
          submissionId,
          requestId,
          fileName,
          format === "xlsx"
            ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            : "application/pdf",
          file.length,
          file,
          now,
        );
      await db
        .prepare("UPDATE report_export_requests SET status='completed',completed_at=? WHERE id=?")
        .run(now, requestId);
      await db
        .prepare(
          `INSERT INTO report_export_history
        (id,request_id,submission_id,report_type_id,template_id,template_name,format,file_name,
         file_size,row_count,filters_json,period_start,period_end,exported_by,exported_at,
         status,error_message)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'completed',NULL)`,
        )
        .run(
          historyId,
          requestId,
          submissionId,
          type.row.id,
          template?.id ?? null,
          template?.name ?? null,
          format,
          fileName,
          file.length,
          built.rows.length,
          JSON.stringify(filters),
          normalized.from,
          normalized.to,
          user.id,
          now,
        );
      await writeAudit(db, {
        actorId: user.id,
        feature: "M08",
        objectType: "report_export",
        objectId: historyId,
        action: "report.exported",
        after: {
          reportType: type.row.code,
          format,
          rowCount: built.rows.length,
          fileName,
          filters,
        },
        ip,
      });
    });
    return { item: historyResponse(await exportHistoryRow(db, historyId)) };
  } catch (error) {
    const historyId = randomUUID();
    await transaction(db, async () => {
      await db
        .prepare("UPDATE report_export_requests SET status='failed',completed_at=? WHERE id=?")
        .run(Date.now(), requestId);
      await db
        .prepare(
          `INSERT INTO report_export_history
        (id,request_id,submission_id,report_type_id,template_id,template_name,format,file_name,
         file_size,row_count,filters_json,period_start,period_end,exported_by,exported_at,
         status,error_message)
        VALUES (?,?,NULL,?,?,?,?,NULL,NULL,0,?,?,?,?,?,'failed',?)`,
        )
        .run(
          historyId,
          requestId,
          type.row.id,
          template?.id ?? null,
          template?.name ?? null,
          format,
          JSON.stringify(filters),
          normalized.from,
          normalized.to,
          user.id,
          Date.now(),
          "Không thể tạo file báo cáo.",
        );
      await writeAudit(db, {
        actorId: user.id,
        feature: "M08",
        objectType: "report_export",
        objectId: historyId,
        action: "report.export_failed",
        after: { reportType: type.row.code, format, error: error.name },
        ip,
      });
    });
    throw error;
  }
}

export async function listReportExports(db, user, url) {
  requireReportAccess(user);
  const { page, pageSize } = pagination(url);
  const clauses = [];
  const params = [];
  const administrator = user.role === "A05" && user.scopes.some((scope) => scope.kind === "all");
  if (!administrator) {
    clauses.push("h.exported_by=?");
    params.push(user.id);
  }
  for (const [key, column] of Object.entries({
    reportTypeId: "h.report_type_id",
    format: "h.format",
    status: "h.status",
  })) {
    const value = url.searchParams.get(key);
    if (!value) continue;
    text(value, key, 1, 100);
    if (key === "format")
      assert(REPORT_FORMATS.includes(value), 400, "INVALID_INPUT", "Định dạng không hợp lệ.");
    if (key === "status")
      assert(
        ["completed", "failed"].includes(value),
        400,
        "INVALID_INPUT",
        "Trạng thái không hợp lệ.",
      );
    clauses.push(`${column}=?`);
    params.push(value);
  }
  const where = clauses.length ? clauses.join(" AND ") : "1=1";
  return {
    items: (
      await db
        .prepare(
          `SELECT h.*,r.code AS report_type_code,r.name AS report_type_name,
          a.full_name AS exporter_name,a.username AS exporter_username
        FROM report_export_history h
        JOIN report_export_types r ON r.id=h.report_type_id
        JOIN accounts a ON a.id=h.exported_by
        WHERE ${where}
        ORDER BY h.exported_at DESC,h.id DESC LIMIT ? OFFSET ?`,
        )
        .all(...params, pageSize, (page - 1) * pageSize)
    ).map(historyResponse),
    total: (
      await db
        .prepare(`SELECT count(*) AS n FROM report_export_history h WHERE ${where}`)
        .get(...params)
    ).n,
    page,
    pageSize,
  };
}

export async function downloadReportFile(db, user, id) {
  requireReportAccess(user, "export");
  const row = await db
    .prepare(
      `SELECT h.*,s.file_name AS stored_file_name,s.content_type,s.file_data
      FROM report_export_history h
      LEFT JOIN report_export_submissions s ON s.id=h.submission_id
      WHERE h.id=?`,
    )
    .get(id);
  assert(row, 404, "NOT_FOUND", "Không tìm thấy lịch sử xuất báo cáo.");
  const administrator = user.role === "A05" && user.scopes.some((scope) => scope.kind === "all");
  assert(
    administrator || row.exported_by === user.id,
    403,
    "FORBIDDEN",
    "Bạn không có quyền tải file báo cáo này.",
  );
  assert(
    row.status === "completed" && row.file_data,
    404,
    "NOT_FOUND",
    "Lần xuất báo cáo này không có file.",
  );
  return {
    file_name: row.stored_file_name ?? row.file_name,
    content_type: row.content_type,
    file_data: Buffer.from(row.file_data),
  };
}
