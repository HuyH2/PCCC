import { auditActionLabels, formatAuditTime, type AuditEntry } from "@/lib/legal-document-contract";

export function AuditSnapshots({ entry }: { entry: AuditEntry }) {
  if (!entry.before_json && !entry.after_json) return <span>—</span>;
  const pretty = (json: string | null) => {
    if (!json) return "Không có";
    try {
      return JSON.stringify(JSON.parse(json), null, 2);
    } catch {
      return json;
    }
  };
  return (
    <details>
      <summary className="cursor-pointer text-primary">Xem dữ liệu trước/sau</summary>
      <div className="grid gap-3 py-3 lg:grid-cols-2">
        <div>
          <p className="font-medium">Trước thay đổi</p>
          <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-3 text-xs">
            {pretty(entry.before_json)}
          </pre>
        </div>
        <div>
          <p className="font-medium">Sau thay đổi</p>
          <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-3 text-xs">
            {pretty(entry.after_json)}
          </pre>
        </div>
      </div>
    </details>
  );
}

export function AuditHistory({ entries }: { entries: AuditEntry[] }) {
  return (
    <ol className="space-y-4">
      {entries.map((entry) => (
        <li key={entry.id} className="rounded border p-3">
          <p className="font-medium">
            {entry.actor_name ?? "Hệ thống / chưa xác định"} ·{" "}
            {auditActionLabels[entry.action] ?? entry.action}
          </p>
          <p className="mb-2 text-sm text-muted-foreground">
            {formatAuditTime(entry.occurred_at)} (giờ Việt Nam)
          </p>
          <AuditSnapshots entry={entry} />
        </li>
      ))}
    </ol>
  );
}
