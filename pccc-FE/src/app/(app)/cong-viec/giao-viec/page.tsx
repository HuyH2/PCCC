import Link from "next/link";

import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { backendFetch, requirePage } from "@/lib/backend";
import { toBusinessDate } from "@/lib/date";
import type { TaskRecord } from "@/lib/task-contract";
import { TaskCreateForm } from "./task-create-form";

export const metadata = { title: "Công việc được giao" };

const views = [
  { value: "all", label: "Tất cả" },
  { value: "mine", label: "Việc của tôi" },
  { value: "assigned", label: "Đã giao" },
];

const statusLabels: Record<TaskRecord["status"], string> = {
  open: "Đang thực hiện",
  completed: "Hoàn thành",
  cancelled: "Đã hủy",
};

function statusTone(status: TaskRecord["status"]) {
  return status === "completed" ? "success" : status === "cancelled" ? "danger" : "warning";
}

export default async function TrangGiaoViec({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    view?: string;
    status?: string;
    deadline?: string;
  }>;
}) {
  const user = await requirePage("M07.view");
  const query = await searchParams;
  const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);
  const view = ["all", "mine", "assigned"].includes(query.view ?? "") ? query.view! : "all";
  const status = ["open", "completed", "cancelled"].includes(query.status ?? "")
    ? query.status!
    : "";
  const deadline = ["overdue", "week"].includes(query.deadline ?? "") ? query.deadline! : "";
  const params = new URLSearchParams({ page: String(page), pageSize: "20", view });
  if (status) params.set("status", status);
  if (deadline) params.set("deadline", deadline);
  const response = await backendFetch(`/api/tasks?${params.toString()}`);
  if (!response.ok) throw new Error("Không thể tải danh sách công việc.");
  const result = (await response.json()) as {
    items: TaskRecord[];
    total: number;
    pageSize: number;
  };
  const linkFor = (nextPage: number) => {
    const next = new URLSearchParams(params);
    next.set("page", String(nextPage));
    return `/cong-viec/giao-viec?${next.toString()}`;
  };
  const tabFor = (nextView: string) => {
    const next = new URLSearchParams();
    next.set("view", nextView);
    if (status) next.set("status", status);
    if (deadline) next.set("deadline", deadline);
    return `/cong-viec/giao-viec?${next.toString()}`;
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Giao việc & theo dõi tiến độ"
        description="Giao công việc, theo dõi tiến độ, lọc theo hạn và trao đổi với người thực hiện."
        module="M07"
        useCases={["UC-WRK-02", "UC-WRK-03"]}
      />
      <p className="text-muted-foreground text-sm">
        Danh sách chỉ hiển thị công việc bạn giao hoặc được giao. Công việc có chữ “(mẫu)” là dữ
        liệu demo; công việc mới được tạo bằng nút bên dưới sẽ lưu vào database.
      </p>
      {user.permissions.includes("M07.create") &&
        ["A01", "A02", "A05"].includes(user.role) &&
        user.scopes.some((scope) => scope.kind === "all" || scope.kind === "unit") && (
          <TaskCreateForm />
        )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="bg-muted inline-flex rounded-lg p-1">
          {views.map((item) => (
            <Link
              key={item.value}
              href={tabFor(item.value)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                view === item.value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
        <form method="get" className="flex flex-wrap items-center gap-2 text-sm">
          <input type="hidden" name="view" value={view} />
          <select
            name="status"
            defaultValue={status}
            aria-label="Lọc theo trạng thái"
            className="border-input bg-background h-9 rounded-md border px-2"
          >
            <option value="">Mọi trạng thái</option>
            <option value="open">Đang thực hiện</option>
            <option value="completed">Hoàn thành</option>
            <option value="cancelled">Đã hủy</option>
          </select>
          <select
            name="deadline"
            defaultValue={deadline}
            aria-label="Lọc theo hạn"
            className="border-input bg-background h-9 rounded-md border px-2"
          >
            <option value="">Mọi hạn</option>
            <option value="overdue">Quá hạn</option>
            <option value="week">Đến hạn 7 ngày</option>
          </select>
          <button type="submit" className="border-input h-9 rounded-md border px-3">
            Lọc
          </button>
          {(status || deadline) && (
            <Link href={`/cong-viec/giao-viec?view=${view}`} className="text-muted-foreground">
              Xóa lọc
            </Link>
          )}
        </form>
      </div>

      <div className="space-y-3">
        {result.items.map((task) => (
          <article key={task.id} className="rounded-xl border p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <Link
                  href={`/cong-viec/giao-viec/${encodeURIComponent(task.id)}`}
                  className="text-primary font-semibold hover:underline"
                >
                  {task.title}
                </Link>
                <p className="text-muted-foreground mt-1 text-sm">
                  {task.code}
                  {task.kind === "assigned"
                    ? " · Giao việc"
                    : task.kind === "routine"
                      ? " · Thường xuyên"
                      : " · Đột xuất"}
                </p>
              </div>
              <Badge variant={statusTone(task.status)}>{statusLabels[task.status]}</Badge>
            </div>
            <p className="mt-2 text-sm">
              Người giao: {task.assigner_name} · Người thực hiện: {task.assignee_name}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
              <span>Tiến độ: {task.progress}%</span>
              <progress
                className="h-2 w-40 accent-red-700"
                value={task.progress}
                max={100}
                aria-label={`Tiến độ ${task.title}`}
              />
              <span>
                Hạn:{" "}
                {task.due_at
                  ? new Date(task.due_at).toLocaleDateString("vi-VN", {
                      timeZone: "Asia/Ho_Chi_Minh",
                    })
                  : "Chưa có"}
              </span>
              {task.status === "open" &&
                task.due_at !== null &&
                toBusinessDate(task.due_at) < toBusinessDate() && (
                  <span className="text-destructive font-medium">Quá hạn</span>
                )}
            </div>
          </article>
        ))}
        {result.items.length === 0 && (
          <p className="text-muted-foreground rounded-xl border p-5 text-sm">
            Không có công việc phù hợp bộ lọc.
          </p>
        )}
      </div>
      <div className="flex items-center gap-4 text-sm">
        <span>
          {result.total} công việc · Trang {page}
        </span>
        {page > 1 && <Link href={linkFor(page - 1)}>Trước</Link>}
        {page * result.pageSize < result.total && <Link href={linkFor(page + 1)}>Sau</Link>}
      </div>
    </div>
  );
}
