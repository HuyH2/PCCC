import { writeAudit } from "../modules/audit/audit.service.js";

// DEMO ONLY. Checklist wording is illustrative, not an official inspection form (Q04/BR-12).
const checklists = [
  {
    id: "CL-CHUNG",
    name: "Checklist kiểm tra an toàn PCCC chung (mẫu)",
    facilityType: null,
    description: "Áp dụng cho mọi loại cơ sở. Nội dung giả lập phục vụ demo.",
    items: [
      ["Hồ sơ quản lý, theo dõi hoạt động PCCC của cơ sở", "Đối chiếu hồ sơ lưu tại cơ sở."],
      ["Nội quy, biển cấm, biển báo, sơ đồ chỉ dẫn thoát nạn", "Quan sát thực tế tại khu vực."],
      [
        "Phương tiện chữa cháy tại chỗ (bình chữa cháy, họng nước)",
        "Kiểm tra số lượng, hạn kiểm định.",
      ],
      ["Lối thoát nạn, đèn chiếu sáng sự cố", "Kiểm tra lối thoát không bị che chắn."],
      ["Hệ thống điện, thiết bị sử dụng điện", "Quan sát dây dẫn, thiết bị bảo vệ."],
      ["Lực lượng PCCC cơ sở và phương án chữa cháy", "Không bắt buộc với cơ sở nhỏ (mẫu).", false],
    ],
  },
  {
    id: "CL-NHA-CAO-TANG",
    name: "Checklist nhà cao tầng (mẫu)",
    facilityType: "Nhà cao tầng",
    description: "Bổ sung cho nhà cao tầng. Nội dung giả lập phục vụ demo.",
    items: [
      ["Hệ thống báo cháy tự động", "Thử hoạt động đầu báo, tủ trung tâm."],
      ["Hệ thống chữa cháy tự động (sprinkler)", "Kiểm tra áp lực, van khóa."],
      ["Thang bộ thoát nạn, cửa ngăn cháy", "Kiểm tra cửa tự đóng, không chèn chặn."],
    ],
  },
];

export async function seedInspections(db) {
  const now = Date.now();
  for (const checklist of checklists) {
    if (await db.prepare("SELECT 1 FROM inspection_checklists WHERE id=?").get(checklist.id))
      continue;
    await db
      .prepare(
        `INSERT INTO inspection_checklists(id,name,facility_type,description,created_at)
      VALUES (?,?,?,?,?)`,
      )
      .run(checklist.id, checklist.name, checklist.facilityType, checklist.description, now);
    for (const [index, [content, guidance, required = true]] of checklist.items.entries())
      await db
        .prepare(
          `INSERT INTO inspection_checklist_items(id,checklist_id,position,content,guidance,legal_reference,is_required)
          VALUES (?,?,?,?,?,?,?)`,
        )
        .run(
          `${checklist.id}-${index + 1}`,
          checklist.id,
          index + 1,
          content,
          guidance,
          "Văn bản mẫu (không có giá trị pháp lý)",
          required ? 1 : 0,
        );
  }
  const samples = [
    [
      "DEMO-INS-1",
      "KT-DEMO-0001",
      "CS001",
      "unscheduled",
      null,
      "Phản ánh của người dân (giả lập)",
    ],
    [
      "DEMO-INS-2",
      "KT-DEMO-0002",
      "CS002",
      "thematic",
      "Chuyên đề mùa khô (mẫu)",
      "Kế hoạch chuyên đề (giả lập)",
    ],
  ];
  for (const [id, code, facilityId, kind, topic, reason] of samples) {
    if (await db.prepare("SELECT 1 FROM inspections WHERE id=?").get(id)) continue;
    await db
      .prepare(
        `INSERT INTO inspections(id,code,facility_id,kind,topic,reason,scheduled_date,lead_officer_id,
        checklist_id,created_by,updated_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        id,
        code,
        facilityId,
        kind,
        topic,
        reason,
        "2026-10-20",
        "CB-A03",
        "CL-CHUNG",
        "DEMO-A03",
        "DEMO-A03",
        now,
        now,
      );
    await writeAudit(db, {
      actorId: "DEMO-A03",
      feature: "M06",
      objectType: "inspection",
      objectId: id,
      action: "inspection.seeded",
      after: { id, code, facility_id: facilityId, kind, demo: true },
      ip: "seed",
    });
  }
}
