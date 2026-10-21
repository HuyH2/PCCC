export type ReportFormat = "xlsx" | "pdf";

export interface ReportTypeRecord {
  id: string;
  code: string;
  name: string;
  description: string;
  dataset_key: string;
  scope_kind: "facility" | "account";
  supports_period: boolean;
  supports_region: boolean;
  default_format: ReportFormat;
  template_count: number;
  official_template_count: number;
}

export interface ReportColumn {
  key: string;
  label: string;
  numeric: boolean;
  suffix: string;
}

export interface ReportSummaryItem {
  label: string;
  value: number | string;
  unit: string;
}

export interface ReportFilters {
  from: string | null;
  to: string | null;
  regionId: string | null;
  regionName: string | null;
  officerId: string | null;
  officerName: string | null;
  templateId: string | null;
  templateName?: string | null;
}

export interface ReportTemplateRecord {
  id: string;
  report_type_id: string;
  report_type_code: string | null;
  name: string;
  format: ReportFormat;
  title: string;
  header_note: string;
  footer_note: string;
  column_labels: Record<string, string>;
  is_official: boolean;
  created_at: number;
}

export interface ReportPreview {
  reportType: {
    id: string;
    code: string;
    name: string;
    description: string;
    scope_kind: "facility" | "account";
    supports_period: boolean;
    supports_region: boolean;
    default_format: ReportFormat;
    template: ReportTemplateRecord | null;
  };
  columns: ReportColumn[];
  rows: Record<string, string>[];
  total: number;
  page: number;
  pageSize: number;
  maxRows: number;
  summary: ReportSummaryItem[];
  filters: ReportFilters;
  period: { from: string; to: string } | null;
  generatedAt: number;
}

export interface ReportExportRecord {
  id: string;
  report_type_id: string;
  report_type_code: string;
  report_type_name: string;
  template_id: string | null;
  template_name: string | null;
  format: ReportFormat;
  file_name: string | null;
  file_size: number | null;
  row_count: number;
  filters: ReportFilters;
  period_start: string | null;
  period_end: string | null;
  exported_by: string;
  exporter_name: string;
  exporter_username: string;
  exported_at: number;
  status: "completed" | "failed";
  error_message: string | null;
  download_url: string | null;
}

export interface ReportOptions {
  regions: { id: string; name: string }[];
  facility_officers: { id: string; name: string; facility_count: number }[];
  account_officers: { id: string; name: string; username: string }[];
  formats: { value: ReportFormat; label: string }[];
  defaults: { from: string; to: string };
  maxRows: number;
}
