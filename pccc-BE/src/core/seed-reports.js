import { businessDate } from "./time.js";
import { notifyUser } from "../modules/notifications/notifications.service.js";

/** Synthetic records only. All inserts are idempotent and never rewrite user changes. */
export function seedReports(db) {
  const now = Date.now();
  const today = businessDate(now);
  const dateOffset = (days) => {
    const [year, month, day] = today.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
  };
  const types = [
    ["BC-TYPE-WEEK", "Báo cáo công tác PCCC tuần", "weekly", 3],
    ["BC-TYPE-MONTH", "Báo cáo kiểm tra an toàn PCCC tháng", "monthly", 5],
    ["BC-TYPE-QUARTER", "Báo cáo cơ sở nguy cơ cao quý", "quarterly", 10],
    ["BC-TYPE-YEAR", "Tổng kết công tác PCCC năm", "yearly", 30],
    ["BC-TYPE-ADHOC", "Báo cáo đột xuất theo văn bản đến", "once", 2],
  ];
  for (const [id, name, cycle, days] of types)
    db.prepare(
      `INSERT OR IGNORE INTO report_types
      (id,name,description,cycle,warning_days,created_by,created_at,updated_at)
      VALUES (?,?,'Dữ liệu giả lập phục vụ kiểm thử.',?,?,?,?,?)`,
    ).run(id, name, cycle, days, "DEMO-A05", now, now);
  const assignees = ["DEMO-A04", "DEMO-A02", "DEMO-A03", "DEMO-A01"];
  const offsets = [-24, -12, -4, -1, 0, 1, 2, 4, 8, 16, 35, 55];
  for (let i = 1; i <= 48; i++) {
    const id = `BC-DEMO-${String(i).padStart(3, "0")}`;
    const type = types[(i - 1) % types.length];
    const due = dateOffset(offsets[(i - 1) % offsets.length]);
    const status = i % 11 === 0 ? "completed" : i % 7 === 0 ? "submitted" : "open";
    db.prepare(
      `INSERT OR IGNORE INTO report_requests
      (id,report_type_id,title,recipient,reference_number,requester_id,assignee_id,due_date,warning_days,status,created_at,updated_at,completed_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).run(
      id,
      type[0],
      `${type[1]} - hồ sơ mẫu ${String(i).padStart(2, "0")}`,
      i % 3 === 0 ? "PC07 - Ban chỉ huy" : "Đội Khu vực 10 (mẫu)",
      i % 5 === 0 ? `VB-${i}/PC07-MAU` : null,
      "DEMO-A05",
      assignees[(i - 1) % assignees.length],
      due,
      type[3],
      status,
      now - i * 86400000,
      now - i * 3600000,
      status === "completed" ? now - i * 3600000 : null,
    );
    if (status !== "open") {
      const pdf = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF\n");
      db.prepare(
        `INSERT OR IGNORE INTO report_submissions
        (id,request_id,submitted_by,note,file_name,content_type,file_size,file_data,submitted_at)
        VALUES (?,?,?,?,?,?,?,?,?)`,
      ).run(
        `BC-SUB-DEMO-${i}`,
        id,
        assignees[(i - 1) % assignees.length],
        "Báo cáo mẫu đã nộp.",
        `bao-cao-mau-${i}.pdf`,
        "application/pdf",
        pdf.length,
        pdf,
        now - i * 3600000,
      );
    }
    const current = db
      .prepare(
        "SELECT title,assignee_id,due_date,warning_days,status FROM report_requests WHERE id=?",
      )
      .get(id);
    const daysLeft =
      (Date.parse(`${current.due_date}T00:00:00+07:00`) - Date.parse(`${today}T00:00:00+07:00`)) /
      86400000;
    if (current.status === "open" && daysLeft <= current.warning_days) {
      const overdue = daysLeft < 0;
      notifyUser(db, {
        userId: current.assignee_id,
        feature: "M08",
        kind: overdue ? "overdue" : "due_soon",
        title: overdue ? "Báo cáo quá hạn" : "Báo cáo sắp đến hạn",
        body: `${current.title} · hạn ${current.due_date}`,
        targetPath: `/bao-cao/${id}`,
        objectId: id,
        dedupeKey: `report:${id}:${overdue ? "overdue" : "due_soon"}:${today}`,
      });
    }
  }
  for (let i = 0; i < 4; i++)
    db.prepare(
      `INSERT OR IGNORE INTO report_schedules
      (id,report_type_id,assignee_id,requester_id,recipient,next_due_date,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?)`,
    ).run(
      `BC-SCHEDULE-DEMO-${i + 1}`,
      types[i][0],
      assignees[i],
      "DEMO-A05",
      "Đội Khu vực 10 (mẫu)",
      dateOffset(7 + i * 7),
      now,
      now,
    );
}
