"use client";

import * as React from "react";
import { Eye, Loader2, Mail, Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  officerStatusNames,
  type Officer,
  type OrganizationOptions,
} from "@/lib/organization-contract";
import { organizationApi, organizationErrorMessage } from "@/lib/organization-client";

export function OfficerDetails({
  officer,
  roles,
}: {
  officer: Officer;
  roles: OrganizationOptions["roles"];
}) {
  const [open, setOpen] = React.useState(false);
  const [detail, setDetail] = React.useState<Officer | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [revision, setRevision] = React.useState(0);
  React.useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setDetail(null);
    organizationApi<{ officer: Officer }>(`/api/officers/${encodeURIComponent(officer.id)}`, {
      signal: controller.signal,
    })
      .then((result) => {
        if (!controller.signal.aborted) setDetail(result.officer);
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(organizationErrorMessage(cause));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [open, officer.id, revision]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label={`Chi tiết ${officer.fullName}`}
          title={`Chi tiết ${officer.fullName}`}
        >
          <Eye />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Hồ sơ cán bộ</DialogTitle>
          <DialogDescription>
            {officer.fullName} · {officer.officerCode}
          </DialogDescription>
        </DialogHeader>
        {loading && (
          <p role="status" className="flex items-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" />
            Đang tải hồ sơ…
          </p>
        )}
        {error && (
          <div role="alert" className="space-y-3">
            <p className="text-destructive text-sm">{error}</p>
            <Button variant="outline" size="sm" onClick={() => setRevision((value) => value + 1)}>
              Thử lại
            </Button>
          </div>
        )}
        {detail && (
          <>
            <Badge className="w-fit" variant={detail.status === "ACTIVE" ? "success" : "muted"}>
              {officerStatusNames[detail.status]}
            </Badge>
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              {[
                ["Mã số", detail.officerCode],
                ["Họ và tên", detail.fullName],
                ["Cấp bậc", detail.rank],
                ["Chức vụ", detail.position],
                ["Đơn vị", detail.unitName],
                [
                  "Vai trò nghiệp vụ",
                  `${detail.businessRole} · ${roles.find((role) => role.code === detail.businessRole)?.name ?? detail.businessRole}`,
                ],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-muted-foreground text-xs">{label}</dt>
                  <dd className="mt-1 break-words font-medium">{value}</dd>
                </div>
              ))}
              <div>
                <dt className="text-muted-foreground text-xs">Điện thoại</dt>
                <dd className="mt-1">
                  <a
                    className="text-primary inline-flex items-center gap-1 hover:underline"
                    href={`tel:${detail.phone.replace(/[^+\d]/g, "")}`}
                  >
                    <Phone className="size-3.5" />
                    {detail.phone}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Email</dt>
                <dd className="mt-1 break-all">
                  <a
                    className="text-primary inline-flex items-center gap-1 hover:underline"
                    href={`mailto:${detail.email}`}
                  >
                    <Mail className="size-3.5 shrink-0" />
                    {detail.email}
                  </a>
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground text-xs">Ghi chú</dt>
                <dd className="mt-1 whitespace-pre-wrap break-words">{detail.notes || "—"}</dd>
              </div>
              {detail.statusEffectiveDate && (
                <div>
                  <dt className="text-muted-foreground text-xs">Ngày hiệu lực trạng thái</dt>
                  <dd className="mt-1">
                    {detail.statusEffectiveDate.split("-").reverse().join("/")}
                  </dd>
                </div>
              )}
              {detail.statusReason && (
                <div>
                  <dt className="text-muted-foreground text-xs">Lý do thay đổi trạng thái</dt>
                  <dd className="mt-1 whitespace-pre-wrap break-words">{detail.statusReason}</dd>
                </div>
              )}
              <div>
                <dt className="text-muted-foreground text-xs">Ngày tạo</dt>
                <dd className="mt-1">
                  {new Date(detail.createdAt).toLocaleString("vi-VN", {
                    timeZone: "Asia/Ho_Chi_Minh",
                  })}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Cập nhật gần nhất</dt>
                <dd className="mt-1">
                  {new Date(detail.updatedAt).toLocaleString("vi-VN", {
                    timeZone: "Asia/Ho_Chi_Minh",
                  })}
                </dd>
              </div>
            </dl>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
