import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { backendFetch, requirePage } from "@/lib/backend";
import type { TaskRecord } from "@/lib/task-contract";
import { TaskCreateForm } from "./task-create-form";

export const metadata = { title: "Công việc được giao" };

export default async function TrangGiaoViec({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await requirePage("M07.view");
  const query = await searchParams;
  const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);
  const response = await backendFetch(`/api/tasks?page=${page}&pageSize=20`);
  if (!response.ok) throw new Error("Không thể tải danh sách công việc.");
  const result = (await response.json()) as {
    items: TaskRecord[];
    total: number;
    pageSize: number;
  };
  return (
    <div className="space-y-5">
      <PageHeader
        title="Giao việc & theo dõi tiến độ"
        description="Giao công việc, theo dõi tiến độ và trao đổi với người thực hiện."
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
                <p className="text-muted-foreground mt-1 text-sm">{task.code}</p>
              </div>
              <span className="rounded-md border px-2 py-1 text-xs">
                {task.status === "open"
                  ? "Đang thực hiện"
                  : task.status === "completed"
                    ? "Hoàn thành"
                    : "Đã hủy"}
              </span>
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
            </div>
          </article>
        ))}
        {result.items.length === 0 && (
          <p className="text-muted-foreground rounded-xl border p-5 text-sm">
            Bạn chưa tham gia công việc nào.
          </p>
        )}
      </div>
      <div className="flex items-center gap-4 text-sm">
        <span>
          {result.total} công việc · Trang {page}
        </span>
        {page > 1 && <Link href={`/cong-viec/giao-viec?page=${page - 1}`}>Trước</Link>}
        {page * result.pageSize < result.total && (
          <Link href={`/cong-viec/giao-viec?page=${page + 1}`}>Sau</Link>
        )}
      </div>
    </div>
  );
}
