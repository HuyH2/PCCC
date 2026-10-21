import { hashPassword } from "./password.js";
import { transaction } from "./database.js";
import { seedLegalDocuments } from "./seed-legal-documents.js";
import { seedInspections } from "./seed-inspections.js";
import { seedFacilityViolations } from "./seed-facility-violations.js";
import { seedTasks } from "./seed-tasks.js";
import { seedKpi } from "./seed-kpi.js";

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
    db.prepare("INSERT OR IGNORE INTO units(id,name,parent_id,code,level) VALUES (?,?,?,?,?)").run(
      "DV-PC07",
      "PC07 (mẫu)",
      null,
      "DV-PC07",
      "ROOT",
    );
    db.prepare("INSERT OR IGNORE INTO units(id,name,parent_id,code,level) VALUES (?,?,?,?,?)").run(
      "DV-KV10",
      "Đội khu vực 10 (mẫu)",
      "DV-PC07",
      "DV-KV10",
      "AREA",
    );
    db.prepare("INSERT OR IGNORE INTO units(id,name,parent_id,code,level) VALUES (?,?,?,?,?)").run(
      "DV-KV11",
      "Đội khu vực 11 (mẫu)",
      "DV-PC07",
      "DV-KV11",
      "AREA",
    );
    db.prepare("INSERT OR IGNORE INTO regions(id,name,unit_id,code) VALUES (?,?,?,?)").run(
      "KP01",
      "Khu phố 01 (mẫu)",
      "DV-KV10",
      "KP01",
    );
    db.prepare("INSERT OR IGNORE INTO regions(id,name,unit_id,code) VALUES (?,?,?,?)").run(
      "KP02",
      "Khu phố 02 (mẫu)",
      "DV-KV10",
      "KP02",
    );
    db.prepare("INSERT OR IGNORE INTO regions(id,name,unit_id,code) VALUES (?,?,?,?)").run(
      "KP03",
      "Khu phố 03 (mẫu)",
      "DV-KV11",
      "KP03",
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
      A01: [
        "M07.view",
        "M07.create",
        "M07.edit",
        "M03.view",
        "M03.approve",
        "M03.export",
        "M10.view",
        "M05.view",
        "M05.create",
        "M05.edit",
        "M06.view",
        "M06.create",
        "M02.view",
        "M02.edit",
      ],
      A02: [
        "M07.view",
        "M07.create",
        "M07.edit",
        "M03.view",
        "M10.view",
        "M05.view",
        "M06.view",
        "M06.create",
        "M06.edit",
        "M02.view",
        "M02.edit",
      ],
      A03: [
        "M07.view",
        "M07.create",
        "M07.edit",
        "M03.view",
        "M03.create",
        "M03.edit",
        "M10.view",
        "M05.view",
        "M06.view",
        "M06.create",
        "M06.edit",
      ],
      A04: [
        "M03.view",
        "M03.export",
        "M10.view",
        "M05.view",
        "M06.view",
        "M07.view",
        "M07.create",
        "M07.edit",
      ],
      A05: [
        "M01.view",
        "M01.edit",
        "M02.view",
        "M02.create",
        "M02.edit",
        "M03.view",
        "M10.view",
        "M05.view",
        "M05.create",
        "M05.edit",
        "M07.view",
        "M07.create",
        "M07.edit",
      ],
      A06: ["M03.view", "M10.view", "M05.view", "M06.view"],
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
    // Explicit synthetic profiles for the account ids used by assignments and M09.
    for (const role of Object.keys(usernames))
      db.prepare(
        `INSERT OR IGNORE INTO officers
         (id,officer_code,full_name,rank,position,phone,email,notes,unit_id,business_role,created_at,updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      ).run(
        `CB-${role}`,
        `CB-${role}`,
        `${roleNames[role]} (dữ liệu mẫu)`,
        "Cấp bậc mẫu",
        roleNames[role],
        "0900000000",
        `${role.toLowerCase()}@example.invalid`,
        "Hồ sơ giả lập phục vụ kiểm thử.",
        role === "A05" || role === "A06" ? "DV-PC07" : "DV-KV10",
        role,
        Date.now(),
        Date.now(),
      );
    db.prepare(
      `INSERT OR IGNORE INTO officers
       (id,officer_code,full_name,rank,position,phone,email,notes,unit_id,business_role,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).run(
      "CB-OTHER",
      "CB-OTHER",
      "Cán bộ khu vực 11 (dữ liệu mẫu)",
      "Cấp bậc mẫu",
      "Cán bộ mẫu",
      "0900000001",
      "other@example.invalid",
      "Hồ sơ giả lập liên kết cơ sở mẫu.",
      "DV-KV11",
      "A03",
      Date.now(),
      Date.now(),
    );
    // Existing demo installations had no M07 grants. Add sample grants only
    // when M07 has never been configured; preserve any administrator choices.
    if (
      !db.prepare("SELECT 1 FROM role_permissions WHERE permission_code LIKE 'M07.%' LIMIT 1").get()
    )
      for (const role of ["A01", "A02", "A03", "A04", "A05"])
        for (const action of ["view", "create", "edit"])
          db.prepare("INSERT OR IGNORE INTO role_permissions VALUES (?,?)").run(
            role,
            `M07.${action}`,
          );
    // Demo assignments only. Preserve existing ownership after a transfer or later seed run.
    for (const [regionId, accountId] of [
      ["KP01", "DEMO-A03"],
      ["KP02", "DEMO-A01"],
    ])
      db.prepare(
        "INSERT OR IGNORE INTO region_assignments(region_id,account_id,assigned_at) VALUES (?,?,?)",
      ).run(regionId, accountId, Date.now());
    seedLegalDocuments(db);
    seedInspections(db);
    seedFacilityViolations(db);
    seedTasks(db);
    seedKpi(db);
  });
}
