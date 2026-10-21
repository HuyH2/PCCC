/** Synthetic directory records for exercising M02 lists, search, filters and pagination. */
const demoUnits = [
  ["DEMO-ORG-KV12", "DEMO-KV12", "Đội khu vực 12 (mẫu)", "DV-PC07", "AREA"],
  ["DEMO-ORG-KV13", "DEMO-KV13", "Đội khu vực 13 (mẫu)", "DV-PC07", "AREA"],
  ["DEMO-ORG-KV14", "DEMO-KV14", "Đội khu vực 14 (mẫu)", "DV-PC07", "AREA"],
  ["DEMO-ORG-KV15", "DEMO-KV15", "Đội khu vực 15 (mẫu)", "DV-PC07", "AREA"],
  ["DEMO-ORG-P01", "DEMO-P01", "Phường Hòa Bình (mẫu)", "DV-KV10", "WARD"],
  ["DEMO-ORG-P02", "DEMO-P02", "Phường An Phú (mẫu)", "DV-KV10", "WARD"],
  ["DEMO-ORG-P03", "DEMO-P03", "Phường Tân Thuận (mẫu)", "DV-KV11", "WARD"],
  ["DEMO-ORG-P04", "DEMO-P04", "Phường Bình Hưng (mẫu)", "DEMO-ORG-KV12", "WARD"],
  ["DEMO-ORG-P05", "DEMO-P05", "Phường Phú Nhuận (mẫu)", "DEMO-ORG-KV12", "WARD"],
  ["DEMO-ORG-P06", "DEMO-P06", "Phường Tân Hòa (mẫu)", "DEMO-ORG-KV13", "WARD"],
  ["DEMO-ORG-P07", "DEMO-P07", "Phường Minh Khai (mẫu)", "DEMO-ORG-KV14", "WARD"],
  ["DEMO-ORG-P08", "DEMO-P08", "Phường Vĩnh Phước (mẫu)", "DEMO-ORG-KV15", "WARD"],
];

const surnames = [
  "Nguyễn",
  "Trần",
  "Lê",
  "Phạm",
  "Hoàng",
  "Huỳnh",
  "Phan",
  "Vũ",
  "Võ",
  "Đặng",
  "Bùi",
  "Đỗ",
];
const givenNames = ["Minh Anh", "Quốc Bảo", "Thị Cúc", "Văn Dũng", "Thu Hà", "Đức Khánh"];
const positions = [
  ["Chỉ huy tổ", "A01"],
  ["Phó chỉ huy tổ", "A02"],
  ["Cán bộ quản lý địa bàn", "A03"],
  ["Cán bộ kiểm tra PCCC", "A03"],
  ["Cán bộ tổng hợp", "A04"],
  ["Cán bộ trực ban", "A03"],
];
const ranks = ["Thiếu úy", "Trung úy", "Thượng úy", "Đại úy", "Thiếu tá"];

export function seedOrganizationDemo(db) {
  const now = Date.now();
  const insertedUnits = new Set();
  const insertUnit = db.prepare(
    `INSERT OR IGNORE INTO units
     (id,code,name,parent_id,level,status,notes,created_at,updated_at)
     VALUES (?,?,?,?,?,'ACTIVE',?,?,?)`,
  );
  for (const [id, code, name, parentId, level] of demoUnits) {
    const result = insertUnit.run(
      id,
      code,
      name,
      parentId,
      level,
      "Dữ liệu mẫu phục vụ kiểm thử M02.",
      now,
      now,
    );
    if (result.changes) insertedUnits.add(id);
    const saved = db.prepare("SELECT code FROM units WHERE id=?").get(id);
    if (saved?.code !== code) throw new Error(`Demo unit ID conflict: ${id}`);
  }

  const insertOfficer = db.prepare(
    `INSERT OR IGNORE INTO officers
     (id,officer_code,full_name,rank,position,phone,email,notes,unit_id,business_role,
      status,status_reason,status_effective_date,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  );
  for (let index = 0; index < 72; index++) {
    const number = String(index + 1).padStart(3, "0");
    const id = `DEMO-ORG-O${number}`;
    const officerCode = `ORG-M${number}`;
    const unitId = demoUnits[Math.floor(index / 6)][0];
    const [position, role] = positions[index % 6];
    const status =
      index > 0 && index % 17 === 0
        ? "TRANSFERRED"
        : index > 0 && index % 11 === 0
          ? "INACTIVE"
          : "ACTIVE";
    insertOfficer.run(
      id,
      officerCode,
      `${surnames[Math.floor(index / 6)]} ${givenNames[index % 6]} (mẫu)`,
      ranks[index % ranks.length],
      position,
      `0000100${number}`,
      `demo.org.${number}@example.invalid`,
      "Hồ sơ giả lập phục vụ kiểm thử, không phải thông tin cán bộ thật.",
      unitId,
      role,
      status,
      status === "ACTIVE" ? null : "Trạng thái giả lập để kiểm thử bộ lọc.",
      status === "ACTIVE" ? null : "2026-10-01",
      now,
      now,
    );
    const saved = db.prepare("SELECT officer_code FROM officers WHERE id=?").get(id);
    if (saved?.officer_code !== officerCode) throw new Error(`Demo officer ID conflict: ${id}`);
  }

  const setLeader = db.prepare("UPDATE units SET leader_officer_id=? WHERE id=?");
  for (const [index, [unitId]] of demoUnits.entries())
    if (insertedUnits.has(unitId))
      setLeader.run(`DEMO-ORG-O${String(index * 6 + 1).padStart(3, "0")}`, unitId);
}
