import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { backendFetch, requirePage } from "@/lib/backend";
import type { TaskRecord } from "@/lib/task-contract";
import { TaskConversation } from "./task-conversation";
import { TaskProgress } from "./task-progress";

export default async function TrangChiTietCongViec({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePage("M07.view");
  const { id } = await params;
  const response = await backendFetch(`/api/tasks/${encodeURIComponent(id)}`);
  if (response.status === 404) notFound();
  if (!response.ok) throw new Error("Không thể tải công việc.");
  const { task } = (await response.json()) as { task: TaskRecord };
  return (
    <div className="space-y-5">
      <Link href="/cong-viec/giao-viec" className="text-primary text-sm hover:underline">
        ← Danh sách công việc
      </Link>
      <PageHeader
        title={task.title}
        description={`${task.code} · Người giao: ${task.assigner_name} · Người thực hiện: ${task.assignee_name}`}
        module="M07"
        useCases={["UC-WRK-03"]}
      />
      {task.description && <p className="rounded-xl border p-4 text-sm">{task.description}</p>}
      <TaskProgress
        task={task}
        isAssignee={task.assigned_to === user.id}
        canUpdate={
          task.status === "open" &&
          task.assigned_to === user.id &&
          user.permissions.includes("M07.edit")
        }
      />
      <TaskConversation
        taskId={task.id}
        currentUserId={user.id}
        canSend={task.status === "open" && user.permissions.includes("M07.create")}
        canEdit={task.status === "open" && user.permissions.includes("M07.edit")}
      />
    </div>
  );
}
