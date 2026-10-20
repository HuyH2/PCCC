import { hashPassword } from "./password.js";
import { transaction } from "./database.js";

export const roleNames = {
  A01: "Chỉ huy/Đội trưởng",
  A02: "Phó chỉ huy/Tổ trưởng",
  A03: "Cán bộ kiểm tra/Quản lý địa bàn",
  A04: "Cán bộ tổng hợp",
  A05: "Quản trị hệ thống",
  A06: "Lãnh đạo cấp phòng/Người xem",
  A07: "Cấp phường (chưa kích hoạt)",
};

/** DEMO ONLY. Q02 is unapproved; these grants are editable, never an official policy. */
export async function seedDemo(db, password) {
  if (process.env.NODE_ENV === "production")
    throw new Error("Demo seed is prohibited in production.");
  if (typeof password !== "string" || password.length < 12 || password.length > 256)
    throw new Error("Set DEMO_PASSWORD to a temporary password with 12–256 characters.");
  const passwordHash = await hashPassword(password);
  transaction(db, () => {
    for (const [code, name] of Object.entries(roleNames))
      db.prepare("INSERT OR IGNORE INTO roles VALUES (?,?,?)").run(
        code,
        name,
        code === "A07" ? 0 : 1,
      );
    for (let i = 1; i <= 11; i++)
      for (const action of ["view", "create", "edit", "approve", "export"]) {
        const module = `M${String(i).padStart(2, "0")}`;
        db.prepare("INSERT OR IGNORE INTO permissions VALUES (?,?,?)").run(
          `${module}.${action}`,
          module,
          action,
        );
      }
    db.prepare("INSERT OR IGNORE INTO units VALUES (?,?,?)").run("DV-PC07", "PC07 (mẫu)", null);
    db.prepare("INSERT OR IGNORE INTO units VALUES (?,?,?)").run(
      "DV-KV10",
      "Đội khu vực 10 (mẫu)",
      "DV-PC07",
    );
    db.prepare("INSERT OR IGNORE INTO units VALUES (?,?,?)").run(
      "DV-KV11",
      "Đội khu vực 11 (mẫu)",
      "DV-PC07",
    );
    db.prepare("INSERT OR IGNORE INTO regions VALUES (?,?,?)").run(
      "KP01",
      "Khu phố 01 (mẫu)",
      "DV-KV10",
    );
    db.prepare("INSERT OR IGNORE INTO regions VALUES (?,?,?)").run(
      "KP02",
      "Khu phố 02 (mẫu)",
      "DV-KV10",
    );
    db.prepare("INSERT OR IGNORE INTO regions VALUES (?,?,?)").run(
      "KP03",
      "Khu phố 03 (mẫu)",
      "DV-KV11",
    );
    for (const [id, region, officer] of [
      ["CS001", "KP01", "CB-A03"],
      ["CS002", "KP02", "CB-OTHER"],
      ["CS003", "KP03", "CB-OTHER"],
    ]) {
      db.prepare(
        "INSERT OR IGNORE INTO facilities(id,name,address,region_id,officer_id) VALUES (?,?,?,?,?)",
      ).run(id, `Cơ sở ${id} (dữ liệu mẫu)`, "Địa chỉ giả lập", region, officer);
    }
    const grants = {
      A01: ["M03.view", "M03.approve", "M03.export", "M04.view", "M04.approve", "M10.view"],
      A02: ["M03.view", "M04.view", "M10.view"],
      A03: ["M03.view", "M03.create", "M03.edit", "M04.view", "M04.create", "M04.edit", "M10.view"],
      A04: ["M03.view", "M03.export", "M04.view", "M10.view"],
      A05: ["M01.view", "M01.edit", "M03.view", "M04.view", "M04.create", "M04.edit", "M04.approve", "M10.view"],
      A06: ["M03.view", "M04.view", "M10.view"],
    };
    const usernames = {
      A01: "demo.chi-huy",
      A02: "demo.to-truong",
      A03: "demo.can-bo",
      A04: "demo.tong-hop",
      A05: "demo.admin",
      A06: "demo.nguoi-xem",
    };
    for (const [role, username] of Object.entries(usernames)) {
      const id = `DEMO-${role}`;
      // Existing account, password, permissions and scope must survive re-seeding.
      if (db.prepare("SELECT 1 FROM accounts WHERE id=?").get(id)) continue;
      const roleHasAccounts = db.prepare("SELECT 1 FROM accounts WHERE role_code=?").get(role);
      if (!roleHasAccounts)
        for (const code of grants[role])
          db.prepare("INSERT OR IGNORE INTO role_permissions VALUES (?,?)").run(role, code);
      db.prepare(
        "INSERT INTO accounts(id,username,password_hash,full_name,officer_id,role_code,created_at) VALUES (?,?,?,?,?,?,?)",
      ).run(id, username, passwordHash, `${roleNames[role]} (mẫu)`, `CB-${role}`, role, Date.now());
      const kind = role === "A05" || role === "A06" ? "all" : role === "A03" ? "region" : "unit";
      db.prepare(
        "INSERT INTO account_scopes(account_id,kind,unit_id,region_id) VALUES (?,?,?,?)",
      ).run(id, kind, kind === "unit" ? "DV-KV10" : null, kind === "region" ? "KP01" : null);
    }
    const sampleFacility = db.prepare("SELECT id,officer_id FROM facilities WHERE id='CS001'").get();
    const sampleActor = db.prepare("SELECT id FROM accounts WHERE role_code='A03' ORDER BY id LIMIT 1").get();
    if (sampleFacility && sampleActor && !db.prepare("SELECT 1 FROM violations WHERE id='VP-DEMO-001'").get()) {
      const now = Date.now();
      const detectedOn = new Date(now).toISOString().slice(0, 10);
      const deadline = new Date(now + 20 * 86400000).toISOString().slice(0, 10);
      db.prepare(`INSERT INTO violations(id,facility_id,violation_type,severity,detected_on,description,facility_condition,remediation_deadline,tracked_officer_id,status,created_by,created_at,updated_at)
        VALUES ('VP-DEMO-001',?,'Thiếu hồ sơ/phương án','Trung bình',?,'Thiếu tài liệu phương án PCCC trong hồ sơ mẫu.','violation',?,?,'remediation',?,?,?)`)
        .run(sampleFacility.id, detectedOn, deadline, sampleFacility.officer_id, sampleActor.id, now, now);
      db.prepare("INSERT INTO remediation_records(id,violation_id,note,progress,created_by,created_at) VALUES ('VR-DEMO-001','VP-DEMO-001','Đã yêu cầu cơ sở bổ sung tài liệu.',40,?,?)").run(sampleActor.id, now);
      db.prepare("INSERT INTO violation_status_history(violation_id,from_status,to_status,reason,actor_id,occurred_at) VALUES ('VP-DEMO-001',NULL,'recorded','Ghi nhận dữ liệu mẫu',?,?)").run(sampleActor.id, now - 1);
      db.prepare("INSERT INTO violation_status_history(violation_id,from_status,to_status,reason,actor_id,occurred_at) VALUES ('VP-DEMO-001','recorded','remediation','Khởi tạo tiến độ khắc phục mẫu',?,?)").run(sampleActor.id, now);
    }
  });
}
