/**
 * M08 report catalogue. These are data exports over completed modules, not official
 * business form layouts. A confirmed template can override only title/labels/notes
 * (see report_templates); the SQL and column keys stay in code so a template cannot
 * widen the data scope.
 */
export const REPORT_DEFINITIONS = {
  R01: {
    code: "R01",
    name: "Tổng hợp cơ sở theo địa bàn",
    dataset: "facilities",
    scope: "facility",
    supportsPeriod: false,
    supportsRegion: true,
    columns: [
      { key: "id", label: "Mã cơ sở", width: 1.0 },
      { key: "name", label: "Tên cơ sở", width: 2.3 },
      { key: "address", label: "Địa chỉ", width: 2.3 },
      { key: "region_name", label: "Khu vực", width: 1.4 },
      { key: "unit_name", label: "Đơn vị", width: 1.5 },
      { key: "officer_name", label: "Cán bộ phụ trách", width: 1.5 },
      { key: "status", label: "Trạng thái", width: 1.2, labels: facilityStatuses },
    ],
  },
  R03: {
    code: "R03",
    name: "Vi phạm, đình chỉ, khắc phục",
    dataset: "violations",
    scope: "facility",
    supportsPeriod: true,
    supportsRegion: true,
    columns: [
      { key: "facility_id", label: "Mã cơ sở", width: 0.9 },
      { key: "facility_name", label: "Tên cơ sở", width: 1.8 },
      { key: "region_name", label: "Khu vực", width: 1.1 },
      { key: "description", label: "Nội dung vi phạm", width: 2.8 },
      {
        key: "suspension_decision_reference",
        label: "Quyết định đình chỉ",
        width: 1.5,
      },
      {
        key: "suspension_at",
        label: "Thời điểm đình chỉ",
        width: 1.2,
        format: "datetime",
      },
      { key: "status", label: "Trạng thái", width: 1.0, labels: violationStatuses },
      {
        key: "restoration_decision_reference",
        label: "Quyết định khắc phục",
        width: 1.5,
      },
      {
        key: "approved_at",
        label: "Thời điểm khắc phục",
        width: 1.2,
        format: "datetime",
      },
    ],
  },
  R05: {
    code: "R05",
    name: "Kết quả kiểm tra",
    dataset: "inspections",
    scope: "facility",
    supportsPeriod: true,
    supportsRegion: true,
    columns: [
      { key: "code", label: "Mã kiểm tra", width: 1.2 },
      { key: "facility_name", label: "Cơ sở", width: 2.0 },
      { key: "region_name", label: "Khu vực", width: 1.2 },
      { key: "kind", label: "Loại kiểm tra", width: 1.3, labels: inspectionKinds },
      {
        key: "scheduled_date",
        label: "Ngày kiểm tra",
        width: 1.1,
        format: "date",
      },
      { key: "lead_officer_name", label: "Cán bộ chủ trì", width: 1.5 },
      { key: "status", label: "Trạng thái", width: 1.2, labels: inspectionStatuses },
      { key: "outcome", label: "Kết quả", width: 1.2, labels: inspectionOutcomes },
    ],
  },
  R06: {
    code: "R06",
    name: "Công việc theo cán bộ",
    dataset: "tasks",
    scope: "account",
    supportsPeriod: true,
    supportsRegion: false,
    columns: [
      { key: "full_name", label: "Cán bộ", width: 2.0 },
      { key: "username", label: "Tài khoản", width: 1.3 },
      { key: "assigned_tasks", label: "Tổng việc", width: 0.9, numeric: true },
      { key: "completed_tasks", label: "Hoàn thành", width: 0.9, numeric: true },
      { key: "open_tasks", label: "Đang mở", width: 0.9, numeric: true },
      { key: "overdue_tasks", label: "Quá hạn", width: 0.9, numeric: true },
      { key: "routine_tasks", label: "Thường xuyên", width: 1.0, numeric: true },
      { key: "unscheduled_tasks", label: "Đột xuất", width: 0.9, numeric: true },
      { key: "assigned_kind_tasks", label: "Được giao", width: 0.9, numeric: true },
      {
        key: "completion_rate",
        label: "Tỷ lệ hoàn thành",
        width: 1.1,
        numeric: true,
        suffix: "%",
      },
    ],
  },
};

export const FACILITY_STATUS_LABELS = facilityStatuses;
export const VIOLATION_STATUS_LABELS = violationStatuses;
export const INSPECTION_STATUS_LABELS = inspectionStatuses;
export const INSPECTION_KIND_LABELS = inspectionKinds;
export const INSPECTION_OUTCOME_LABELS = inspectionOutcomes;

function facilityStatuses(value) {
  return {
    active: "Đang hoạt động",
    paused: "Tạm dừng",
    suspended: "Đình chỉ",
    unlicensed: "Không phép",
  }[value];
}
function violationStatuses(value) {
  return { suspended: "Đang đình chỉ", restored: "Đã khắc phục" }[value];
}
function inspectionKinds(value) {
  return { periodic: "Định kỳ", unscheduled: "Đột xuất", thematic: "Chuyên đề" }[value];
}
function inspectionStatuses(value) {
  return {
    planned: "Đã lập kế hoạch",
    in_progress: "Đang thực hiện",
    evaluated: "Đã có kết quả",
    completed: "Hoàn thành",
  }[value];
}
function inspectionOutcomes(value) {
  return { pass: "Đạt", conditional: "Đạt có điều kiện", fail: "Không đạt" }[value];
}
