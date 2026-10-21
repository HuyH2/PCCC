import Link from "next/link";
import { AlertTriangle, CalendarClock, ListChecks } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { backendFetch, requirePage } from "@/lib/backend";
import { toBusinessDate } from "@/lib/date";
import type { TaskRecord } from "@/lib/task-contract";

export const metadata = { title: "Lịch công tác" };

const weekdays = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];

function displayDate(iso: string) {
  return new Date(`${iso}T00:00:00+07:00`).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  });
}

function taskTone(task: TaskRecord) {
  if (task.status === "completed") return "success" as const;
  if (task.status === "cancelled") return "danger" as const;
  return task.due_at !== null && toBusinessDate(task.due_at) < toBusinessDate()
    ? ("danger" as const)
    : ("warning" as const);
}

export default async function TrangLichCongTac() {
  await requirePage("M07.view");
  const today = toBusinessDate();
  const start = new Date(`${today}T00:00:00+07:00`);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start.getTime() + index * 86400000);
    const iso = toBusinessDate(date);
    return {
      iso,
      weekday: weekdays[new Date(`${iso}T12:00:00+07:00`).getUTCDay()],
      isToday: iso === today,
    };
  });
  const end = days[days.length - 1].iso;
  const [scheduleResponse, overdueResponse] = await Promise.all([
    backendFetch(`/api/tasks?from=${today}&to=${end}&pageSize=100&sort=due`),
    backendFetch("/api/tasks?deadline=overdue&pageSize=20&sort=due"),
  ]);
  if (!scheduleResponse.ok) throw new Error("Không thể tải lịch công tác.");
  const schedule = (await scheduleResponse.json()) as { items: TaskRecord[] };
  const overdue = overdueResponse.ok
    ? ((await overdueResponse.json()) as { items: TaskRecord[] }).items
    : [];
  const byDate = new Map<string, TaskRecord[]>();
  for (const task of schedule.items) {
    if (task.due_at === null) continue;
    const key = toBusinessDate(task.due_at);
    byDate.set(key, [...(byDate.get(key) ?? []), task]);
  }
  const completedThisWeek = schedule.items.filter((task) => task.status === "completed").length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Lịch công tác hàng ngày"
        description="Công việc đến hạn trong 7 ngày tới và các việc đang quá hạn của bạn. Lịch kiểm tra chuyên ngành thuộc module M06."
        module="M07"
        useCases={["UC-WRK-01"]}
        actions={
          <Link
            href="/cong-viec/giao-viec"
            className="bg-primary text-primary-foreground inline-flex h-9 items-center rounded-md px-3 text-sm font-medium"
          >
            Giao việc
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Việc đến hạn 7 ngày"
          value={schedule.items.length}
          icon={CalendarClock}
          tone="info"
        />
        <StatCard
          label="Đang quá hạn"
          value={overdue.length}
          icon={AlertTriangle}
          tone={overdue.length > 0 ? "danger" : "success"}
        />
        <StatCard
          label="Đã hoàn thành trong lịch"
          value={completedThisWeek}
          icon={ListChecks}
          tone="success"
        />
      </div>

      {overdue.length > 0 && (
        <SectionCard
          title="Cần xử lý ngay"
          description={`${overdue.length} công việc đã quá hạn nhưng chưa hoàn thành.`}
          className="border-destructive/30"
          contentClassName="space-y-2"
        >
          {overdue.map((task) => (
            <Link
              key={task.id}
              href={`/cong-viec/giao-viec/${encodeURIComponent(task.id)}`}
              className="hover:bg-muted/60 flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"
            >
              <span className="font-medium">{task.title}</span>
              <span className="text-destructive text-xs">
                Hạn {task.due_at ? displayDate(toBusinessDate(task.due_at)) : "—"}
              </span>
            </Link>
          ))}
        </SectionCard>
      )}

      <div className="grid gap-3 lg:grid-cols-7">
        {days.map((day) => {
          const tasks = byDate.get(day.iso) ?? [];
          return (
            <section
              key={day.iso}
              className={`rounded-xl border p-3 ${
                day.isToday ? "border-primary/50 bg-primary/5" : "bg-card"
              }`}
            >
              <div className="mb-3 flex items-baseline justify-between gap-1">
                <div>
                  <p className="text-xs font-semibold uppercase">{day.weekday}</p>
                  <p className="text-muted-foreground text-xs">{displayDate(day.iso)}</p>
                </div>
                {day.isToday && <Badge variant="info">Hôm nay</Badge>}
              </div>
              <div className="space-y-2">
                {tasks.length === 0 ? (
                  <p className="text-muted-foreground text-xs">Không có việc đến hạn.</p>
                ) : (
                  tasks.map((task) => (
                    <Link
                      key={task.id}
                      href={`/cong-viec/giao-viec/${encodeURIComponent(task.id)}`}
                      className="hover:bg-muted/60 block rounded-lg border p-2"
                    >
                      <p className="line-clamp-2 text-[13px] font-medium">{task.title}</p>
                      <div className="text-muted-foreground mt-1 flex items-center justify-between gap-1 text-[11px]">
                        <span className="truncate">{task.assignee_name}</span>
                        <Badge variant={taskTone(task)} className="px-1.5 py-0 text-[10px]">
                          {task.status === "completed"
                            ? "Xong"
                            : task.status === "cancelled"
                              ? "Hủy"
                              : `${task.progress}%`}
                        </Badge>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
