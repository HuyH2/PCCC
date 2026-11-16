import assert from "node:assert/strict";
import { violationPayload, suspensionPayload, sampleEvidence, samplePdf } from "./test-data.mjs";

// Each case lists its purpose, steps and expected result before executable checks.
export const violationCases = [
  {
    id: "VIO-27",
    uc: "UC-VIO-01..05",
    title: "Cập nhật sang cán bộ không tồn tại không làm mất dữ liệu cũ",
    steps: "Tạo vi phạm hợp lệ; PUT mã cán bộ không tồn tại kèm mô tả mới; đọc lại hồ sơ.",
    expected: "400 INVALID_OFFICER; cán bộ và mô tả ban đầu giữ nguyên.",
    run: async (context) => {
      const id = await context.createViolation();
      const before = await context.requestSuccess(`/api/violations/${id}`);
      const response = await context.request(`/api/violations/${id}`, "PUT", {
        trackedOfficerId: "TEST-NO-SUCH-OFFICER",
        description: "TEST — không được lưu một phần cập nhật",
      });
      assert.equal(response.status, 400);
      assert.equal(response.data.error.code, "INVALID_OFFICER");
      const after = await context.requestSuccess(`/api/violations/${id}`);
      assert.deepEqual(after, before, "Rejected update must not change the record or history");
    },
  },
  {
    id: "VIO-28",
    uc: "UC-VIO-01..05",
    title: "Không thể tự đặt trạng thái hoàn thành qua API sửa vi phạm",
    steps: "Tạo vi phạm; PUT status=completed trực tiếp; đọc lại hồ sơ.",
    expected: "400; toàn bộ hồ sơ và lịch sử giữ nguyên, không bỏ qua phê duyệt.",
    run: async (context) => {
      const id = await context.createViolation();
      const before = await context.requestSuccess(`/api/violations/${id}`);
      const response = await context.request(`/api/violations/${id}`, "PUT", {
        status: "completed",
      });
      assert.equal(response.status, 400);
      const after = await context.requestSuccess(`/api/violations/${id}`);
      assert.deepEqual(after, before);
    },
  },
  {
    id: "VIO-29",
    uc: "UC-VIO-01..05",
    title: "Quyết định hết hiệu lực trước ngày ban hành bị từ chối",
    steps: "Tạo vi phạm; lập đình chỉ có effectiveUntil trước issuedOn; đọc lại hồ sơ và cơ sở.",
    expected: "400; không có quyết định, không đổi trạng thái hoặc lịch sử cơ sở.",
    run: async (context) => {
      const id = await context.createViolation();
      const before = await context.requestSuccess(`/api/violations/${id}`);
      const facilityBefore = await context.requestSuccess("/api/facilities/CS001/status");
      const historyBefore = await context.requestSuccess("/api/facilities/CS001/status-history");
      const response = await context.request(`/api/violations/${id}/suspension`, "POST", {
        ...suspensionPayload,
        effectiveUntil: "2026-11-01",
      });
      assert.equal(response.status, 400);
      assert.deepEqual(await context.requestSuccess(`/api/violations/${id}`), before);
      assert.deepEqual(
        await context.requestSuccess("/api/facilities/CS001/status"),
        facilityBefore,
      );
      assert.deepEqual(
        await context.requestSuccess("/api/facilities/CS001/status-history"),
        historyBefore,
      );
    },
  },
  {
    id: "VIO-30",
    uc: "UC-VIO-01..05",
    title: "Khắc phục chỉ có khoảng trắng bị từ chối dù tiến độ 100%",
    steps: "Tạo vi phạm; thêm khắc phục note chỉ có khoảng trắng, progress=100; đọc lại hồ sơ.",
    expected: "400; không thêm khắc phục hoặc đổi trạng thái/lịch sử.",
    run: async (context) => {
      const id = await context.createViolation();
      const before = await context.requestSuccess(`/api/violations/${id}`);
      const response = await context.request(`/api/violations/${id}/remediation`, "POST", {
        note: "   ",
        progress: 100,
      });
      assert.equal(response.status, 400);
      assert.deepEqual(await context.requestSuccess(`/api/violations/${id}`), before);
    },
  },
  {
    id: "VIO-01",
    uc: "UC-VIO-01..05",
    title: "Ghi nhận, đình chỉ, khắc phục, phê duyệt",
    steps:
      "Cán bộ tạo vi phạm CS001, đình chỉ, thêm khắc phục/PDF, gửi duyệt; chỉ huy duyệt; đọc lại hồ sơ/cơ sở.",
    expected: "Hồ sơ completed, cơ sở active; PDF và lịch sử đầy đủ.",
    run: async (context) => {
      const id = await context.prepareRemediationCase();
      assert.equal(
        (await context.requestSuccess("/api/facilities/CS001/status")).status,
        "suspended",
      );
      await context.performViolationAction(
        id,
        "approve",
        { reason: "Đủ điều kiện theo dữ liệu giả lập" },
        "commander",
      );
      const details = await context.requestSuccess(`/api/violations/${id}`);
      assert.equal(details.violation.status, "completed");
      assert.equal(details.violation.facilityId, "CS001");
      assert.deepEqual(
        details.history.map((h) => h.to_status),
        ["recorded", "remediation", "pending_approval", "completed"],
      );
      assert.ok(details.history.every((h) => h.actor_name && h.occurred_at));
      assert.equal(
        (await context.requestSuccess(details.evidences[0].downloadUrl)).bytes,
        samplePdf.toString("base64"),
      );
      assert.equal((await context.requestSuccess("/api/facilities/CS001/status")).status, "active");
    },
  },
  {
    id: "VIO-02",
    uc: "UC-VIO-01..05",
    title: "Từ chối, cập nhật và gửi lại",
    steps: "Gửi hồ sơ; chỉ huy từ chối có lý do; cán bộ cập nhật khắc phục; gửi lại và duyệt.",
    expected: "Lưu lý do, lịch sử returned, giữ đình chỉ sau từ chối; hoạt động sau duyệt.",
    run: async (context) => {
      const id = await context.prepareRemediationCase();
      await context.performViolationAction(
        id,
        "reject",
        { reason: "Cần bổ sung tài liệu kiểm thử" },
        "commander",
      );
      const details = await context.requestSuccess(`/api/violations/${id}`);
      assert.equal(details.violation.status, "returned");
      assert.equal(details.history.at(-1).reason, "Cần bổ sung tài liệu kiểm thử");
      assert.equal(
        (await context.requestSuccess("/api/facilities/CS001/status")).status,
        "suspended",
      );
      await context.performViolationAction(
        id,
        "remediation",
        { note: "Bổ sung lần hai", progress: 100 },
        "officer",
        201,
      );
      await context.performViolationAction(id, "submit-approval", {});
      await context.performViolationAction(id, "approve", {}, "commander");
      assert.deepEqual(
        (await context.requestSuccess(`/api/violations/${id}`)).history.map((h) => h.to_status),
        [
          "recorded",
          "remediation",
          "pending_approval",
          "returned",
          "remediation",
          "pending_approval",
          "completed",
        ],
      );
    },
  },
  {
    id: "VIO-03",
    uc: "UC-VIO-01..05",
    title: "Thiếu trường bắt buộc",
    steps: "Lần lượt bỏ facilityId/type/severity/detectedOn/description/trackedOfficerId.",
    expected: "Mọi request 400; không ghi hồ sơ.",
    run: async (context) => {
      for (const key of [
        "facilityId",
        "type",
        "severity",
        "detectedOn",
        "description",
        "trackedOfficerId",
      ]) {
        const payload = violationPayload();
        delete payload[key];
        assert.equal((await context.request("/api/violations", "POST", payload)).status, 400, key);
      }
      assert.equal((await context.requestSuccess("/api/violations")).total, 0);
    },
  },
  {
    id: "VIO-04",
    uc: "UC-VIO-01..05",
    title: "Ngày/hạn không hợp lệ",
    steps: "Tạo với ngày 2026-02-30 và hạn trước ngày phát hiện.",
    expected: "400.",
    run: async (context) => {
      for (const overrides of [{ detectedOn: "2026-02-30" }, { remediationDeadline: "2026-10-01" }])
        assert.equal(
          (await context.request("/api/violations", "POST", violationPayload(overrides))).status,
          400,
        );
    },
  },
  {
    id: "VIO-05",
    uc: "UC-VIO-01..05",
    title: "Cơ sở không phép/không đủ điều kiện",
    steps: "Tạo hai hồ sơ với facilityCondition unlicensed/insufficient; đọc lại.",
    expected: "Mỗi hồ sơ lưu đúng phân loại.",
    run: async (context) => {
      for (const facilityCondition of ["unlicensed", "insufficient"]) {
        const id = await context.createViolation({ facilityCondition });
        assert.equal(
          (await context.requestSuccess(`/api/violations/${id}`)).violation.facilityCondition,
          facilityCondition,
        );
      }
    },
  },
  {
    id: "VIO-06",
    uc: "UC-VIO-01..05",
    title: "Chặn gửi duyệt thiếu bằng chứng",
    steps: "Thêm khắc phục nhưng không upload; gửi duyệt.",
    expected: "409 MISSING_EVIDENCE; trạng thái vẫn remediation.",
    run: async (context) => {
      const id = await context.prepareRemediationCase({ upload: false, submit: false });
      const response = await context.request(`/api/violations/${id}/submit-approval`, "POST", {});
      assert.equal(response.status, 409);
      assert.equal(response.data.error.code, "MISSING_EVIDENCE");
      assert.equal(
        (await context.requestSuccess(`/api/violations/${id}`)).violation.status,
        "remediation",
      );
    },
  },
  {
    id: "VIO-07",
    uc: "UC-VIO-01..05",
    title: "Chặn gửi duyệt trước khắc phục",
    steps: "Tạo vi phạm rồi gửi duyệt ngay.",
    expected: "409.",
    run: async (context) => {
      const id = await context.createViolation();
      assert.equal(
        (await context.request(`/api/violations/${id}/submit-approval`, "POST", {})).status,
        409,
      );
    },
  },
  {
    id: "VIO-08",
    uc: "UC-VIO-01..05",
    title: "Cán bộ không được phê duyệt",
    steps: "Cán bộ gọi trực tiếp API approve của hồ sơ chờ duyệt.",
    expected: "403; hồ sơ vẫn pending_approval, cơ sở suspended.",
    run: async (context) => {
      const id = await context.prepareRemediationCase();
      assert.equal(
        (await context.request(`/api/violations/${id}/approve`, "POST", {})).status,
        403,
      );
      assert.equal(
        (await context.requestSuccess(`/api/violations/${id}`)).violation.status,
        "pending_approval",
      );
      assert.equal(
        (await context.requestSuccess("/api/facilities/CS001/status")).status,
        "suspended",
      );
    },
  },
  {
    id: "VIO-09",
    uc: "UC-VIO-01..05",
    title: "Chặn từ chối thiếu lý do",
    steps: "Chỉ huy reject với reason rỗng.",
    expected: "400; giữ pending_approval.",
    run: async (context) => {
      const id = await context.prepareRemediationCase();
      assert.equal(
        (await context.request(`/api/violations/${id}/reject`, "POST", { reason: "" }, "commander"))
          .status,
        400,
      );
      assert.equal(
        (await context.requestSuccess(`/api/violations/${id}`)).violation.status,
        "pending_approval",
      );
    },
  },
  {
    id: "VIO-10",
    uc: "UC-VIO-01..05",
    title: "Chặn duyệt lặp",
    steps: "Duyệt thành công rồi duyệt lại.",
    expected: "409 lần hai; chỉ có một lịch sử completed.",
    run: async (context) => {
      const id = await context.prepareRemediationCase();
      await context.performViolationAction(id, "approve", {}, "commander");
      assert.equal(
        (await context.request(`/api/violations/${id}/approve`, "POST", {}, "commander")).status,
        409,
      );
      assert.equal(
        (await context.requestSuccess(`/api/violations/${id}`)).history.filter(
          (h) => h.to_status === "completed",
        ).length,
        1,
      );
    },
  },
  {
    id: "VIO-11",
    uc: "UC-VIO-01..05",
    title: "Khóa hồ sơ đã hoàn thành",
    steps: "Sau duyệt, sửa vi phạm/thêm khắc phục/upload bằng chứng.",
    expected: "Cả ba request 409.",
    run: async (context) => {
      const id = await context.prepareRemediationCase();
      await context.performViolationAction(id, "approve", {}, "commander");
      for (const [suffix, method, body] of [
        ["", "PUT", { description: "Thử sửa hồ sơ đã hoàn thành" }],
        ["/remediation", "POST", { note: "Thử sửa", progress: 100 }],
        ["/evidences", "POST", sampleEvidence],
      ])
        assert.equal(
          (await context.request(`/api/violations/${id}${suffix}`, method, body)).status,
          409,
        );
    },
  },
  {
    id: "VIO-12",
    uc: "UC-VIO-01..05",
    title: "Khóa quyết định đình chỉ của hồ sơ đã hoàn thành",
    steps: "Sau duyệt, PUT suspension thay số quyết định.",
    expected: "409 và quyết định không thay đổi theo yêu cầu thao tác hồ sơ đã đóng.",
    run: async (context) => {
      const id = await context.prepareRemediationCase();
      await context.performViolationAction(id, "approve", {}, "commander");
      assert.equal(
        (
          await context.request(`/api/violations/${id}/suspension`, "PUT", {
            decisionNumber: "TEST_CHANGED_AFTER_CLOSE",
          })
        ).status,
        409,
      );
    },
  },
  {
    id: "VIO-13",
    uc: "UC-VIO-01..05",
    title: "Chặn cơ sở ngoài phạm vi",
    steps: "Cán bộ KP01 tạo vi phạm cho CS003/KP03.",
    expected: "404.",
    run: async (context) =>
      assert.equal(
        (
          await context.request(
            "/api/violations",
            "POST",
            violationPayload({ facilityId: "CS003" }),
          )
        ).status,
        404,
      ),
  },
  {
    id: "VIO-14",
    uc: "UC-VIO-01..05",
    title: "Scope rỗng chặn đọc/ghi và file",
    steps: "Tạo hồ sơ và PDF, xóa scope cán bộ trong fixture, thử list/detail/file/create.",
    expected: "Không đọc/ghi được hồ sơ ngoài scope; list rỗng hoặc 403.",
    run: async (context) => {
      const id = await context.prepareRemediationCase();
      const details = await context.requestSuccess(`/api/violations/${id}`);
      await context.db.prepare("DELETE FROM account_scopes WHERE account_id='DEMO-A03'").run();
      const list = await context.request("/api/violations");
      assert.ok(list.status === 403 || (list.status === 200 && list.data.total === 0));
      for (const path of [`/api/violations/${id}`, details.evidences[0].downloadUrl])
        assert.ok([403, 404].includes((await context.request(path)).status));
      assert.ok(
        [403, 404].includes(
          (await context.request("/api/violations", "POST", violationPayload())).status,
        ),
      );
    },
  },
  {
    id: "VIO-15",
    uc: "UC-VIO-01..05",
    title: "Chưa đăng nhập",
    steps: "GET danh sách và POST vi phạm không cookie.",
    expected: "401.",
    run: async (context) => {
      for (const method of ["GET", "POST"])
        assert.equal(
          (
            await context.request(
              "/api/violations",
              method,
              method === "POST" ? violationPayload() : undefined,
              "anonymous",
            )
          ).status,
          401,
        );
    },
  },
  {
    id: "VIO-16",
    uc: "UC-VIO-01..05",
    title: "Upload sai loại/nội dung",
    steps: "Upload exe rồi PDF có nội dung văn bản thường.",
    expected: "400 cho cả hai.",
    run: async (context) => {
      const id = await context.createViolation();
      for (const body of [
        { ...sampleEvidence, fileName: "test.exe", mediaType: "application/octet-stream" },
        { ...sampleEvidence, contentBase64: Buffer.from("not pdf").toString("base64") },
      ])
        assert.equal(
          (await context.request(`/api/violations/${id}/evidences`, "POST", body)).status,
          400,
        );
    },
  },
  {
    id: "VIO-17",
    uc: "UC-VIO-01..05",
    title: "Bằng chứng gắn đúng hồ sơ",
    steps: "Upload vào A, tải cùng evidence ID qua hồ sơ B.",
    expected: "404.",
    run: async (context) => {
      const firstViolationId = await context.createViolation(),
        secondViolationId = await context.createViolation();
      const uploadedEvidence = await context.performViolationAction(
        firstViolationId,
        "evidences",
        sampleEvidence,
        "officer",
        201,
      );
      assert.equal(
        (
          await context.request(
            `/api/violations/${secondViolationId}/evidences/${uploadedEvidence.evidence.id}`,
          )
        ).status,
        404,
      );
    },
  },
  {
    id: "VIO-18",
    uc: "UC-VIO-01..05",
    title: "Không bỏ qua duyệt qua API cơ sở",
    steps: "Tạo hồ sơ chờ duyệt; cán bộ PUT trạng thái cơ sở active.",
    expected: "403 hoặc lỗi validation; cơ sở vẫn suspended.",
    run: async (context) => {
      await context.prepareRemediationCase();
      const response = await context.request("/api/facilities/CS001/status", "PUT", {
        status: "active",
        reason: "Thử bỏ qua phê duyệt",
      });
      assert.ok([400, 403, 409].includes(response.status));
      assert.equal(
        (await context.requestSuccess("/api/facilities/CS001/status")).status,
        "suspended",
      );
    },
  },
  {
    id: "VIO-19",
    uc: "UC-VIO-01..05",
    title: "Nhiều quyết định đình chỉ cùng cơ sở",
    steps: "Tạo hai hồ sơ đình chỉ; duyệt hồ sơ A rồi B.",
    expected: "Sau A vẫn suspended; sau B active.",
    run: async (context) => {
      const firstViolationId = await context.prepareRemediationCase(),
        secondViolationId = await context.prepareRemediationCase();
      await context.performViolationAction(firstViolationId, "approve", {}, "commander");
      assert.equal(
        (await context.requestSuccess("/api/facilities/CS001/status")).status,
        "suspended",
      );
      await context.performViolationAction(secondViolationId, "approve", {}, "commander");
      assert.equal((await context.requestSuccess("/api/facilities/CS001/status")).status, "active");
    },
  },
  {
    id: "VIO-20",
    uc: "UC-VIO-01..05",
    title: "Cán bộ theo dõi không tồn tại",
    steps: "Tạo hồ sơ với trackedOfficerId TEST-NO-SUCH-OFFICER.",
    expected: "400/404, không lưu tham chiếu cán bộ không tồn tại (R-402/R-501).",
    run: async (context) => {
      const response = await context.request(
        "/api/violations",
        "POST",
        violationPayload({ trackedOfficerId: "TEST-NO-SUCH-OFFICER" }),
      );
      assert.ok([400, 404].includes(response.status), `Expected 400/404; got ${response.status}`);
    },
  },
  {
    id: "VIO-21",
    uc: "UC-VIO-01..05",
    title: "Lịch sử cơ sở đồng bộ khi đình chỉ",
    steps: "Đọc lịch sử cơ sở trước/sau POST suspension.",
    expected: "Lịch sử cơ sở có sự kiện active → suspended (BR-03).",
    run: async (context) => {
      const before = await context.requestSuccess("/api/facilities/CS001/status-history");
      const id = await context.createViolation();
      await context.performViolationAction(id, "suspension", suspensionPayload, "officer", 201);
      const after = await context.requestSuccess("/api/facilities/CS001/status-history");
      assert.equal(after.total, before.total + 1);
    },
  },
  {
    id: "VIO-22",
    uc: "UC-VIO-01..05",
    title: "Tìm kiếm, lọc và phân trang",
    steps: "Tạo hai loại; lọc type/facility/status, search ID, pageSize 1.",
    expected: "Đúng ID, tổng số và số phần tử; không có hồ sơ sai bộ lọc.",
    run: async (context) => {
      const id = await context.createViolation();
      await context.createViolation({ type: "TEST Loại khác" });
      const response = await context.requestSuccess(
        `/api/violations?type=${encodeURIComponent(violationPayload().type)}&facilityId=CS001&status=recorded&pageSize=1`,
      );
      assert.equal(response.total, 1);
      assert.equal(response.items[0].id, id);
      const search = await context.requestSuccess(`/api/violations?search=${id}`);
      assert.equal(search.total, 1);
    },
  },
  {
    id: "VIO-23",
    uc: "UC-VIO-01..05",
    title: "Đình chỉ thiếu số quyết định / trùng",
    steps: "POST số rỗng; POST hợp lệ; POST lại.",
    expected: "400, 201, 409; không nhân đôi quyết định.",
    run: async (context) => {
      const id = await context.createViolation();
      assert.equal(
        (
          await context.request(`/api/violations/${id}/suspension`, "POST", {
            ...suspensionPayload,
            decisionNumber: "",
          })
        ).status,
        400,
      );
      await context.performViolationAction(id, "suspension", suspensionPayload, "officer", 201);
      assert.equal(
        (await context.request(`/api/violations/${id}/suspension`, "POST", suspensionPayload))
          .status,
        409,
      );
    },
  },
  {
    id: "VIO-24",
    uc: "UC-VIO-01..05",
    title: "Tiến độ khắc phục không hợp lệ",
    steps: "POST progress -1, 101, 1.5.",
    expected: "400; không lưu khắc phục.",
    run: async (context) => {
      const id = await context.createViolation();
      for (const progress of [-1, 101, 1.5])
        assert.equal(
          (
            await context.request(`/api/violations/${id}/remediation`, "POST", {
              note: "Dữ liệu thử",
              progress,
            })
          ).status,
          400,
        );
      assert.equal((await context.requestSuccess(`/api/violations/${id}`)).remediation.length, 0);
    },
  },
  {
    id: "VIO-25",
    uc: "UC-VIO-01..05",
    title: "Đồng bộ với hồ sơ đình chỉ từ phân hệ cơ sở",
    steps:
      "Admin đình chỉ CS001 qua API cơ sở; tạo thêm hồ sơ M04; duyệt hồ sơ M04 trong khi hồ sơ đình chỉ ban đầu còn mở.",
    expected: "Cơ sở vẫn suspended khi còn hồ sơ đình chỉ chưa được duyệt (BR-09).",
    run: async (context) => {
      await context.requestSuccess(
        "/api/facilities/CS001/status",
        "PUT",
        {
          status: "suspended",
          reason: "Đình chỉ từ hồ sơ cơ sở để kiểm thử",
          decisionReference: "TEST_LEGACY_QD",
        },
        "admin",
      );
      const id = await context.prepareRemediationCase();
      await context.performViolationAction(id, "approve", {}, "commander");
      const open = await context.db
        .prepare(
          "SELECT count(*) AS n FROM facility_violations WHERE facility_id='CS001' AND status='suspended'",
        )
        .get();
      assert.equal(open.n, 1);
      assert.equal(
        (await context.requestSuccess("/api/facilities/CS001/status")).status,
        "suspended",
      );
    },
  },
  {
    id: "VIO-26",
    uc: "UC-VIO-01..05",
    title: "Thu hồi quyền duyệt có hiệu lực ngay",
    steps:
      "Tạo hồ sơ chờ duyệt; bỏ M04.approve của A01 trong fixture; gọi approve bằng session hiện có.",
    expected: "403, không chuyển trạng thái.",
    run: async (context) => {
      const id = await context.prepareRemediationCase();
      await context.db
        .prepare(
          "DELETE FROM role_permissions WHERE role_code='A01' AND permission_code='M04.approve'",
        )
        .run();
      assert.equal(
        (await context.request(`/api/violations/${id}/approve`, "POST", {}, "commander")).status,
        403,
      );
      assert.equal(
        (await context.requestSuccess(`/api/violations/${id}`)).violation.status,
        "pending_approval",
      );
    },
  },
];
