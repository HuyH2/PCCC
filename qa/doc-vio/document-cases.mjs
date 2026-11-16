import assert from "node:assert/strict";
import { documentPayload, samplePdf } from "./test-data.mjs";

// Each case lists its purpose, steps and expected result before executable checks.
export const documentCases = [
  {
    id: "DOC-01",
    uc: "UC-DOC-01/02",
    title: "Tạo → phân loại → cập nhật → tìm kiếm → tải PDF",
    steps:
      "Chỉ huy tạo PDF; cập nhật loại decree/version 1; cán bộ tìm TEST-DOC-001, đọc lại và tải PDF.",
    expected: "Lưu đúng, version 2, tìm đúng ID, PDF nguyên vẹn, lịch sử có 2 sự kiện.",
    run: async (context) => {
      const details = (
        await context.requestSuccess(
          "/api/legal-documents",
          "POST",
          documentPayload(),
          "commander",
          201,
        )
      ).document;
      await context.requestSuccess(
        `/api/legal-documents/${details.id}`,
        "PUT",
        documentPayload({ category_id: "decree", version: 1, title: "TEST Văn bản đã sửa" }),
        "commander",
      );
      const list = await context.requestSuccess(
        "/api/legal-documents?q=TEST-DOC-001&categoryId=decree",
      );
      assert.equal(list.total, 1);
      assert.equal(list.items[0].id, details.id);
      const read = (await context.requestSuccess(`/api/legal-documents/${details.id}`)).document;
      assert.equal(read.title, "TEST Văn bản đã sửa");
      assert.equal(read.version, 2);
      assert.equal(
        (await context.requestSuccess(`/api/legal-documents/${details.id}/file`)).bytes,
        samplePdf.toString("base64"),
      );
      assert.equal(
        (await context.requestSuccess(`/api/legal-documents/${details.id}/history`)).total,
        2,
      );
    },
  },
  {
    id: "DOC-02",
    uc: "UC-DOC-02",
    title: "Chặn thiếu tên văn bản",
    steps: "POST văn bản có title rỗng bằng chỉ huy.",
    expected: "400, không tạo bản ghi.",
    run: async (context) => {
      assert.equal(
        (
          await context.request(
            "/api/legal-documents",
            "POST",
            documentPayload({ title: "" }),
            "commander",
          )
        ).status,
        400,
      );
      assert.equal((await context.requestSuccess("/api/legal-documents?q=TEST-DOC-001")).total, 0);
    },
  },
  {
    id: "DOC-03",
    uc: "UC-DOC-02",
    title: "Cán bộ không có quyền tạo",
    steps: "Cán bộ POST văn bản hợp lệ.",
    expected: "403.",
    run: async (context) =>
      assert.equal(
        (await context.request("/api/legal-documents", "POST", documentPayload())).status,
        403,
      ),
  },
  {
    id: "DOC-04",
    uc: "UC-DOC-01",
    title: "Tài liệu yêu cầu đăng nhập",
    steps: "GET danh sách văn bản không cookie.",
    expected: "401.",
    run: async (context) =>
      assert.equal(
        (await context.request("/api/legal-documents", "GET", undefined, "anonymous")).status,
        401,
      ),
  },
];
