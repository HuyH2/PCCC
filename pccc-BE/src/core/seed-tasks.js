/** Demo-only records; re-running seed never replaces a task or conversation. */
export function seedTasks(db) {
  const now = Date.now();
  for (const [id, code, title, description, assigner, assignee, progress, daysUntilDue, kind] of [
    [
      "CV-DEMO-01",
      "CV-DEMO-01",
      "Rà soát hồ sơ PCCC khu phố 01 (mẫu)",
      "Trao đổi và cập nhật tiến độ rà soát hồ sơ mẫu.",
      "DEMO-A01",
      "DEMO-A03",
      35,
      7,
      "assigned",
    ],
    [
      "CV-DEMO-02",
      "CV-DEMO-02",
      "Tổng hợp danh sách cơ sở cần kiểm tra (mẫu)",
      "Công việc mẫu giữa quản trị và cán bộ tổng hợp.",
      "DEMO-A05",
      "DEMO-A04",
      60,
      14,
      "routine",
    ],
    [
      "CV-DEMO-03",
      "CV-DEMO-03",
      "Rà soát cơ sở nguy cơ cao (mẫu)",
      "Kiểm tra danh mục cơ sở cần ưu tiên trong kế hoạch mẫu.",
      "DEMO-A05",
      "DEMO-A03",
      20,
      5,
      "assigned",
    ],
    [
      "CV-DEMO-04",
      "CV-DEMO-04",
      "Chuẩn bị báo cáo công tác tuần (mẫu)",
      "Tổng hợp kết quả thực hiện và các đầu việc còn tồn đọng.",
      "DEMO-A05",
      "DEMO-A02",
      75,
      3,
      "routine",
    ],
    [
      "CV-DEMO-05",
      "CV-DEMO-05",
      "Đối chiếu tiến độ hồ sơ tồn đọng (mẫu)",
      "Rà soát số liệu hồ sơ cần bổ sung trên hệ thống demo.",
      "DEMO-A05",
      "DEMO-A04",
      40,
      10,
      "unscheduled",
    ],
    [
      "CV-DEMO-06",
      "CV-DEMO-06",
      "Kiểm tra phương án chữa cháy (mẫu)",
      "Rà soát nội dung phương án và cập nhật kết quả trong công việc.",
      "DEMO-A01",
      "DEMO-A03",
      15,
      12,
      "assigned",
    ],
    [
      "CV-DEMO-07",
      "CV-DEMO-07",
      "Tổng hợp hoạt động tuyên truyền PCCC (mẫu)",
      "Thống kê hoạt động tuyên truyền tại khu vực được giao.",
      "DEMO-A01",
      "DEMO-A04",
      55,
      8,
      "routine",
    ],
  ]) {
    if (
      !db.prepare("SELECT 1 FROM accounts WHERE id=?").get(assigner) ||
      !db.prepare("SELECT 1 FROM accounts WHERE id=?").get(assignee)
    )
      continue;
    db.prepare(
      `INSERT OR IGNORE INTO tasks
      (id,code,title,description,assigned_by,assigned_to,kind,due_at,progress,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    ).run(
      id,
      code,
      title,
      description,
      assigner,
      assignee,
      kind,
      now + daysUntilDue * 86400000,
      progress,
      now,
      now,
    );
    // 015 added nullable due_at/updated_at to pre-existing demo rows. Fill only
    // untouched sample rows; never replace a task whose progress was edited.
    db.prepare(
      `UPDATE tasks SET kind=?,due_at=?,progress=?,updated_at=?
      WHERE id=? AND code=? AND assigned_by=? AND assigned_to=?
        AND status='open' AND due_at IS NULL AND updated_at IS NULL AND progress=0`,
    ).run(kind, now + daysUntilDue * 86400000, progress, now, id, code, assigner, assignee);
  }
  if (db.prepare("SELECT 1 FROM tasks WHERE id='CV-DEMO-01'").get())
    db.prepare(
      `INSERT OR IGNORE INTO task_messages
      (task_id,sender_id,body,created_at,seed_key) VALUES (?,?,?,?,?)`,
    ).run(
      "CV-DEMO-01",
      "DEMO-A01",
      "Vui lòng cập nhật kết quả rà soát tại đây (dữ liệu mẫu).",
      now,
      "TASK-DEMO-01",
    );

  const conversations = [
    [
      "CV-DEMO-02",
      "DEMO-A05",
      "DEMO-A04",
      "Nhờ tổng hợp danh sách cơ sở cần kiểm tra trong tuần này (mẫu).",
      "Đã đối chiếu danh mục và cập nhật khoảng 60% (mẫu).",
    ],
    [
      "CV-DEMO-03",
      "DEMO-A05",
      "DEMO-A03",
      "Ưu tiên rà soát các cơ sở trong danh mục nguy cơ cao (mẫu).",
      "Đã bắt đầu đối chiếu hồ sơ, sẽ báo các trường hợp cần kiểm tra (mẫu).",
    ],
    [
      "CV-DEMO-04",
      "DEMO-A05",
      "DEMO-A02",
      "Vui lòng hoàn thiện báo cáo công tác tuần (mẫu).",
      "Đã tổng hợp phần lớn số liệu, còn chờ rà soát lần cuối (mẫu).",
    ],
    [
      "CV-DEMO-05",
      "DEMO-A05",
      "DEMO-A04",
      "Kiểm tra các hồ sơ còn thiếu thông tin (mẫu).",
      "Đã đối chiếu một phần hồ sơ và tiếp tục cập nhật (mẫu).",
    ],
    [
      "CV-DEMO-06",
      "DEMO-A01",
      "DEMO-A03",
      "Rà soát phương án chữa cháy và ghi lại nội dung cần bổ sung (mẫu).",
      "Đã tiếp nhận công việc, đang kiểm tra hồ sơ (mẫu).",
    ],
    [
      "CV-DEMO-07",
      "DEMO-A01",
      "DEMO-A04",
      "Tổng hợp số liệu tuyên truyền tại khu vực được giao (mẫu).",
      "Đã tổng hợp các buổi triển khai, tiếp tục bổ sung số liệu (mẫu).",
    ],
  ];
  const insertMessage = db.prepare(`INSERT OR IGNORE INTO task_messages
    (task_id,sender_id,body,created_at,seed_key) VALUES (?,?,?,?,?)`);
  for (const [taskId, assigner, assignee, request, response] of conversations) {
    const task = db.prepare("SELECT assigned_by,assigned_to FROM tasks WHERE id=?").get(taskId);
    if (!task || task.assigned_by !== assigner || task.assigned_to !== assignee) continue;
    // Never inject demo chat into a conversation that a user has already started.
    if (db.prepare("SELECT 1 FROM task_messages WHERE task_id=? LIMIT 1").get(taskId)) continue;
    insertMessage.run(taskId, assigner, request, now - 120000, `${taskId}-MESSAGE-01`);
    insertMessage.run(taskId, assignee, response, now - 60000, `${taskId}-MESSAGE-02`);
  }
}
