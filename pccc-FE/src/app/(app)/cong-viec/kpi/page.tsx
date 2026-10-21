import { AlertTriangle, Gauge, Target, TrendingUp } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { backendFetch, requirePage } from "@/lib/backend";
import { toBusinessDate } from "@/lib/date";
import { type KpiResultResponse, type TaskAssignee } from "@/lib/kpi-contract";
import { KpiTargetForm } from "./kpi-target-form";

export const metadata = { title: "KPI & nợ chỉ tiêu" };

export default async function TrangKPI({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const user = await requirePage("M07.view");
  const query = await searchParams;
  const period = /^\d{4}-(0[1-9]|1[0-2])$/.test(query.period ?? "")
    ? query.period!
    : toBusinessDate().slice(0, 7);
  const response = await backendFetch(`/api/kpi/results?period=${period}`);
  if (!response.ok) throw new Error("Không thể tải kết quả KPI.");
  const data = (await response.json()) as KpiResultResponse;
  const personal = data.items.find((item) => item.account_id === user.id) ?? null;
  const canManage =
    ["A01", "A02", "A05"].includes(user.role) && user.permissions.includes("M07.edit");
  const accounts: TaskAssignee[] = data.items.map((item) => ({
    id: item.account_id,
    full_name: item.full_name,
    username: item.username,
    role_code: item.role_code,
  }));
  const targets = Object.fromEntries(
    data.items.map((item) => [item.account_id, item.target_tasks]),
  );
  const configured = data.items.filter((item) => item.configured);
  const average = configured.length
    ? Math.round(configured.reduce((sum, item) => sum + item.score, 0) / configured.length)
    : 0;
  const totalDebt = data.items.reduce((sum, item) => sum + item.debt, 0);
  const completed = data.items.reduce((sum, item) => sum + item.completed_tasks, 0);
  const waived = data.items.reduce((sum, item) => sum + item.waived_debt, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="KPI & nợ chỉ tiêu"
        description="Theo dõi chỉ tiêu công việc theo tháng. Phần chưa đạt được cộng dồn thành nợ kỳ sau; giải trình được chấp nhận sẽ xóa nợ của kỳ đó."
        module="M07"
        useCases={["UC-WRK-04", "UC-WRK-05"]}
        actions={
          <form method="get" className="flex items-center gap-2">
            <label htmlFor="kpi-period" className="text-muted-foreground text-sm">
              Kỳ
            </label>
            <input
              id="kpi-period"
              type="month"
              name="period"
              defaultValue={period}
              className="border-input bg-background h-9 rounded-md border px-3 text-sm"
            />
            <button type="submit" className="border-input h-9 rounded-md border px-3 text-sm">
              Xem
            </button>
          </form>
        }
      />

      <div className="border-warning/40 bg-warning/8 flex items-start gap-2.5 rounded-xl border p-3 text-[13px]">
        <Badge variant="warning" className="shrink-0 font-mono">
          Q09
        </Badge>
        <p className="text-muted-foreground">
          <strong className="text-foreground font-semibold">
            Công thức đã chốt cho phiên bản này:
          </strong>{" "}
          KPI = số việc hoàn thành / (chỉ tiêu kỳ + nợ kỳ trước), tối đa 100%; phần thiếu cộng vào
          nợ kỳ sau. Giải trình được chấp nhận xóa nợ của kỳ được giải trình. Chỉ tiêu hiện đếm công
          việc đã hoàn thành, có thể mở rộng thêm chỉ tiêu kiểm tra khi URD chốt.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="KPI trung bình đội"
          value={`${average}%`}
          icon={Gauge}
          tone={average >= 75 ? "success" : "warning"}
        />
        <StatCard
          label="Tổng nợ chỉ tiêu"
          value={totalDebt}
          unit="việc"
          icon={Target}
          tone="danger"
        />
        <StatCard
          label="Việc hoàn thành trong kỳ"
          value={completed}
          icon={TrendingUp}
          tone="success"
        />
        <StatCard
          label="Nợ đã được giải trình"
          value={waived}
          unit="việc"
          icon={AlertTriangle}
          tone={waived > 0 ? "info" : "default"}
        />
      </div>

      <SectionCard
        title={`KPI cá nhân · ${personal?.full_name ?? user.fullName}`}
        description={`Kỳ ${period}`}
        contentClassName="space-y-3"
      >
        {!personal || !personal.configured ? (
          <p className="text-muted-foreground text-sm">
            Chưa có chỉ tiêu KPI cho tài khoản trong kỳ này. Quản trị hoặc chỉ huy cấu hình chỉ tiêu
            bên dưới.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span>
                Chỉ tiêu: <strong>{personal.target_tasks}</strong> việc
              </span>
              <span>
                Hoàn thành: <strong>{personal.completed_tasks}</strong> việc
              </span>
              <span>
                Nợ kỳ trước: <strong>{personal.previous_debt}</strong>
              </span>
              <span className={personal.debt > 0 ? "text-destructive font-semibold" : ""}>
                Nợ hiện tại: <strong>{personal.debt}</strong>
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Progress
                value={personal.score}
                className="h-2"
                indicatorClassName={
                  personal.score >= 80
                    ? "bg-success"
                    : personal.score >= 60
                      ? "bg-warning"
                      : "bg-destructive"
                }
              />
              <strong className="w-12 text-right">{personal.score}%</strong>
              <Badge variant={personal.debt === 0 ? "success" : "danger"}>
                {personal.debt === 0 ? "Đạt chỉ tiêu" : "Chưa đạt chỉ tiêu"}
              </Badge>
            </div>
          </>
        )}
      </SectionCard>

      {canManage && (
        <SectionCard
          title="Bảng KPI theo cán bộ"
          description="Chỉ hiển thị tài khoản trong phạm vi được cấp."
          contentClassName="px-0 pb-0"
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cán bộ</TableHead>
                <TableHead className="text-right">Chỉ tiêu</TableHead>
                <TableHead className="text-right">Hoàn thành</TableHead>
                <TableHead className="text-right">Nợ trước</TableHead>
                <TableHead className="text-right">Nợ hiện tại</TableHead>
                <TableHead className="text-right">Đã giải trình</TableHead>
                <TableHead className="w-[160px]">KPI</TableHead>
                <TableHead>Kết quả</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((item) => (
                <TableRow key={item.account_id}>
                  <TableCell>
                    <div className="font-medium">{item.full_name}</div>
                    <div className="text-muted-foreground text-xs">{item.username}</div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {item.configured ? item.target_tasks : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{item.completed_tasks}</TableCell>
                  <TableCell className="text-right tabular-nums">{item.previous_debt}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {item.debt > 0 ? (
                      <span className="text-destructive font-semibold">{item.debt}</span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {item.waived_debt > 0 ? item.waived_debt : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress
                        value={item.score}
                        className="h-2"
                        indicatorClassName={
                          item.score >= 80
                            ? "bg-success"
                            : item.score >= 60
                              ? "bg-warning"
                              : "bg-destructive"
                        }
                      />
                      <span className="w-10 shrink-0 text-right text-[13px] font-bold tabular-nums">
                        {item.configured ? `${item.score}%` : "—"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {item.configured ? (
                      <Badge variant={item.debt === 0 ? "success" : "danger"}>
                        {item.debt === 0 ? "Đạt" : "Chưa đạt"}
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SectionCard>
      )}

      {canManage && accounts.length > 0 && (
        <SectionCard
          title="Cấu hình chỉ tiêu kỳ"
          description={`Kỳ ${period} · đơn vị: việc hoàn thành`}
        >
          <KpiTargetForm accounts={accounts} period={period} targets={targets} />
        </SectionCard>
      )}
    </div>
  );
}
