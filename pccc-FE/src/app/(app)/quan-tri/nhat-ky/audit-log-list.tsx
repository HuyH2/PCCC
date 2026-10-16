"use client";
import { useState, type FormEvent } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { DataPagination } from "@/components/shared/data-pagination";
import { AuditSnapshots } from "@/components/shared/audit-history";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApiData } from "@/lib/use-api-data";
import { auditActionLabels, formatAuditTime, type AuditEntry } from "@/lib/legal-document-contract";
import type { PagedResult } from "@/lib/insights-contract";

export function AuditLogList() {
  const [filters, setFilters] = useState("");
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const result = useApiData<PagedResult<AuditEntry>>(
    `/api/audit-logs?page=${page}&pageSize=${pageSize}&${filters}`,
  );
  const accounts = useApiData<{ items: { id: string; full_name: string; username: string }[] }>(
    "/api/authorization/accounts?pageSize=100",
  );
  function filter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const query = new URLSearchParams();
    for (const key of ["actorId", "feature", "action"]) {
      const value = String(form.get(key) ?? "").trim();
      if (value) query.set(key, value);
    }
    for (const key of ["from", "to"]) {
      const value = String(form.get(key) ?? "");
      if (value) query.set(key, new Date(value).toISOString());
    }
    const from = query.get("from");
    const to = query.get("to");
    if (from && to && from > to) {
      setError("Thời điểm bắt đầu phải trước thời điểm kết thúc.");
      return;
    }
    setFilters(query.toString());
    setPage(1);
  }
  return (
    <div className="space-y-5">
      <PageHeader
        title="Nhật ký thao tác và lịch sử dữ liệu"
        description="Nhật ký chỉ đọc dành cho quản trị có phạm vi toàn hệ thống. Thời gian hiển thị theo giờ Việt Nam."
        module="M01"
        useCases={["UC-SYS-05"]}
      />
      <Card className="gap-0 py-0">
        <form
          onSubmit={filter}
          className="grid items-end gap-3 border-b p-4 sm:grid-cols-2 xl:grid-cols-3"
        >
          <div className="space-y-2">
            <Label htmlFor="audit-actor">Người thực hiện (ID tài khoản)</Label>
            <Input
              id="audit-actor"
              name="actorId"
              list="audit-accounts"
              placeholder="Tất cả người dùng"
              maxLength={128}
            />
            <datalist id="audit-accounts">
              {accounts.data?.items.map((a) => (
                <option value={a.id} key={a.id}>
                  {a.full_name} ({a.username})
                </option>
              ))}
            </datalist>
          </div>
          <div className="space-y-2">
            <Label htmlFor="audit-feature">Chức năng / Feature</Label>
            <Input
              id="audit-feature"
              name="feature"
              list="audit-features"
              placeholder="Ví dụ: M05"
              maxLength={100}
            />
            <datalist id="audit-features">
              {["M05", "M01.auth", "M01.authorization", "system"].map((f) => (
                <option key={f} value={f} />
              ))}
            </datalist>
          </div>
          <div className="space-y-2">
            <Label htmlFor="audit-action">Loại thao tác</Label>
            <Input
              id="audit-action"
              name="action"
              list="audit-actions"
              placeholder="Tất cả thao tác"
              maxLength={100}
            />
            <datalist id="audit-actions">
              {[
                "legal_document.created",
                "legal_document.updated",
                "legal_document.file_uploaded",
                "legal_document.seeded",
                "auth.login",
                "auth.logout",
                "authorization.role_permissions_changed",
                "authorization.account_changed",
              ].map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>
          </div>
          <div className="space-y-2">
            <Label htmlFor="audit-from">Từ thời gian (giờ thiết bị)</Label>
            <Input id="audit-from" name="from" type="datetime-local" step={1} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="audit-to">Đến thời gian (giờ thiết bị)</Label>
            <Input id="audit-to" name="to" type="datetime-local" step={1} />
          </div>
          <Button type="submit">Lọc nhật ký</Button>
        </form>
        {error && (
          <p role="alert" className="p-4 text-destructive">
            {error}
          </p>
        )}
        {accounts.error && (
          <p role="alert" className="p-3">
            Không tải được gợi ý tài khoản. Bạn vẫn có thể lọc bằng ID.{" "}
            <Button variant="outline" onClick={accounts.reload}>
              Tải lại
            </Button>
          </p>
        )}
        {result.loading && (
          <p role="status" className="p-5">
            Đang tải nhật ký…
          </p>
        )}
        {result.error && (
          <p role="alert" className="p-5">
            {result.error}{" "}
            <Button variant="outline" onClick={result.reload}>
              Thử lại
            </Button>
          </p>
        )}
        {result.data &&
          (result.data.items.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Thời gian</TableHead>
                  <TableHead>Người thực hiện</TableHead>
                  <TableHead>Chức năng</TableHead>
                  <TableHead>Thao tác</TableHead>
                  <TableHead>Đối tượng</TableHead>
                  <TableHead>Lịch sử dữ liệu</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.data.items.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {formatAuditTime(entry.occurred_at)}
                    </TableCell>
                    <TableCell>
                      <p>{entry.actor_name ?? "Hệ thống / chưa xác định"}</p>
                      <p className="text-xs text-muted-foreground">
                        {entry.actor_username ?? entry.actor_id}
                      </p>
                    </TableCell>
                    <TableCell>{entry.feature}</TableCell>
                    <TableCell>{auditActionLabels[entry.action] ?? entry.action}</TableCell>
                    <TableCell className="max-w-48 break-all text-xs">
                      {entry.object_type} · {entry.object_id ?? "—"}
                    </TableCell>
                    <TableCell className="min-w-64">
                      <AuditSnapshots entry={entry} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p role="status" className="p-5">
              Không có nhật ký phù hợp.
            </p>
          ))}
        {result.data && (
          <DataPagination
            tong={result.data.total}
            trang={page}
            soDong={pageSize}
            onDoiTrang={setPage}
            onDoiSoDong={setPageSize}
          />
        )}
        <p className="border-t p-3 text-xs text-muted-foreground">
          Nhật ký được lưu bất biến. Không hỗ trợ sửa hoặc xóa log qua ứng dụng.
        </p>
      </Card>
    </div>
  );
}
