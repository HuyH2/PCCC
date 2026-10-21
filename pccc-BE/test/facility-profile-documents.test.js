import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { openDatabase } from "../src/core/database.js";
import { seedDemo } from "../src/core/seed.js";
import { createApp } from "../src/app.js";

const password = "Facility-profile-test-2026";

async function fixture(t) {
  const db = openDatabase(":memory:");
  await seedDemo(db, password);
  db.exec("UPDATE accounts SET must_change_password=0");
  const directory = mkdtempSync(join(tmpdir(), "pccc-facility-files-"));
  const server = createApp(db, { uploadDirectory: directory });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    db.close();
    rmSync(directory, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  async function request(path, { method = "GET", cookie, body, form } = {}) {
    const response = await fetch(base + path, {
      method,
      headers: {
        Origin: "http://localhost:3000",
        ...(cookie ? { Cookie: cookie } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: form ?? (body ? JSON.stringify(body) : undefined),
    });
    const contentType = response.headers.get("content-type") || "";
    return {
      status: response.status,
      headers: response.headers,
      data: contentType.includes("application/json")
        ? await response.json()
        : Buffer.from(await response.arrayBuffer()),
      cookie: response.headers.get("set-cookie")?.split(";")[0],
    };
  }
  async function login(username) {
    const result = await request("/api/auth/login", {
      method: "POST",
      body: { username, password },
    });
    assert.equal(result.status, 200);
    return result.cookie;
  }
  return { db, directory, request, login };
}

function personnel(overrides = {}) {
  return {
    fullName: "Nguyễn Văn An",
    position: "Đội trưởng đội PCCC cơ sở",
    phone: "0903 112 007",
    email: "an@example.invalid",
    isHead: true,
    trainingStatus: "Đã huấn luyện",
    certificateNumber: "123/GCN-PCCC",
    certificateExpiry: "2027-12-31",
    notes: "Dữ liệu hoàn toàn giả lập.",
    isActive: true,
    ...overrides,
  };
}

function uploadForm({
  name = "ho-so.pdf",
  bytes,
  personnelId = "",
  permitted = "true",
  issueDate = "",
  expiryDate = "",
} = {}) {
  const form = new FormData();
  form.set(
    "file",
    new Blob([bytes ?? Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF")], {
      type: "application/pdf",
    }),
    name,
  );
  form.set("documentType", "Hồ sơ quản lý PCCC");
  form.set("description", "Tài liệu kiểm thử được phép sử dụng");
  form.set("personnelId", personnelId);
  form.set("issueDate", issueDate);
  form.set("expiryDate", expiryDate);
  form.set("permitted", permitted);
  return form;
}

function zipContainer(entryNames) {
  const localEntries = [];
  const centralEntries = [];
  let localOffset = 0;

  for (const entryName of entryNames) {
    const name = Buffer.from(entryName);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(name.length, 26);
    localEntries.push(localHeader, name);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt32LE(localOffset, 42);
    centralEntries.push(centralHeader, name);
    localOffset += localHeader.length + name.length;
  }

  const centralDirectory = Buffer.concat(centralEntries);
  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0);
  endRecord.writeUInt16LE(entryNames.length, 8);
  endRecord.writeUInt16LE(entryNames.length, 10);
  endRecord.writeUInt32LE(centralDirectory.length, 12);
  endRecord.writeUInt32LE(localOffset, 16);
  return Buffer.concat([...localEntries, centralDirectory, endRecord]);
}

test("facility personnel migration enforces relationships, history and one active head", async (t) => {
  const { db } = await fixture(t);
  const tables = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('facility_personnel','attachments')",
    )
    .all()
    .map((row) => row.name)
    .sort();
  assert.deepEqual(tables, ["attachments", "facility_personnel"]);
  const now = Date.now();
  const insert = db.prepare(
    `INSERT INTO facility_personnel
    (id,facility_id,full_name,position,is_head,created_by,updated_by,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?)`,
  );
  insert.run(
    "P-1",
    "CS001",
    "Người thứ nhất",
    "Người đứng đầu",
    1,
    "DEMO-A03",
    "DEMO-A03",
    now,
    now,
  );
  assert.throws(() =>
    insert.run(
      "P-2",
      "CS001",
      "Người thứ hai",
      "Người đứng đầu",
      1,
      "DEMO-A03",
      "DEMO-A03",
      now,
      now,
    ),
  );
  assert.throws(() => db.prepare("DELETE FROM facility_personnel WHERE id='P-1'").run());
  assert.throws(() =>
    db
      .prepare(
        `INSERT INTO attachments
        (id,facility_id,personnel_id,document_type,original_name,stored_name,content_type,size_bytes,
          storage_path,uploaded_by,uploaded_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        "A-1",
        "CS002",
        "P-1",
        "Hồ sơ",
        "a.pdf",
        "a.pdf",
        "application/pdf",
        10,
        "a.pdf",
        "DEMO-A03",
        now,
      ),
  );
});

test("personnel APIs manage profiles, replace the head and preserve audit under M03 scope", async (t) => {
  const { db, request, login } = await fixture(t);
  const officer = await login("demo.can-bo");
  const viewer = await login("demo.nguoi-xem");
  const collection = "/api/facilities/CS001/personnel";
  assert.equal((await request(collection)).status, 401);
  assert.equal(
    (await request(collection, { method: "POST", cookie: viewer, body: personnel() })).status,
    403,
  );
  assert.equal(
    (
      await request(collection, {
        method: "POST",
        cookie: officer,
        body: personnel({ email: "bad" }),
      })
    ).status,
    400,
  );
  const first = await request(collection, {
    method: "POST",
    cookie: officer,
    body: personnel(),
  });
  assert.equal(first.status, 201);
  assert.equal(first.data.personnel.is_head, 1);
  assert.equal(first.data.personnel.certificate_number, "123/GCN-PCCC");
  const second = await request(collection, {
    method: "POST",
    cookie: officer,
    body: personnel({ fullName: "Trần Thị Bình", email: null }),
  });
  assert.equal(second.status, 201);
  const list = await request(`${collection}?includeInactive=true`, { cookie: viewer });
  assert.equal(list.status, 200);
  assert.equal(list.data.total, 2);
  assert.equal(list.data.items.filter((item) => item.is_head).length, 1);
  assert.equal(list.data.items.find((item) => item.id === first.data.personnel.id).version, 2);
  const updated = await request(`${collection}/${second.data.personnel.id}`, {
    method: "PUT",
    cookie: officer,
    body: personnel({
      fullName: "Trần Thị Bình",
      email: null,
      isHead: false,
      isActive: false,
      version: second.data.personnel.version,
    }),
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.data.personnel.is_active, 0);
  assert.equal(
    (
      await request(`${collection}/${second.data.personnel.id}`, {
        method: "PUT",
        cookie: officer,
        body: personnel({ version: second.data.personnel.version }),
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request(`${collection}/${first.data.personnel.id}`, {
        method: "DELETE",
        cookie: viewer,
      })
    ).status,
    403,
  );
  const deactivated = await request(`${collection}/${first.data.personnel.id}`, {
    method: "DELETE",
    cookie: officer,
  });
  assert.equal(deactivated.status, 200);
  assert.equal(deactivated.data.personnel.is_active, 0);
  assert.equal(deactivated.data.personnel.is_head, 0);
  assert.equal(
    (
      await request(`${collection}/${first.data.personnel.id}`, {
        method: "DELETE",
        cookie: officer,
      })
    ).status,
    400,
  );
  assert.equal((await request("/api/facilities/CS003/personnel", { cookie: officer })).status, 404);
  assert.equal(
    db.prepare("SELECT count(*) AS n FROM audit_logs WHERE object_type='facility_personnel'").get()
      .n,
    5,
  );
});

test("facility attachments validate files and linked personnel, store private paths, and authorize view/download", async (t) => {
  const { db, directory, request, login } = await fixture(t);
  const officer = await login("demo.can-bo");
  const viewer = await login("demo.nguoi-xem");
  const personnelResult = await request("/api/facilities/CS001/personnel", {
    method: "POST",
    cookie: officer,
    body: personnel({ isHead: false }),
  });
  const personnelId = personnelResult.data.personnel.id;
  const endpoint = "/api/facilities/CS001/attachments";
  assert.equal((await request(endpoint)).status, 401);
  assert.equal(
    (await request(endpoint, { method: "POST", cookie: viewer, form: uploadForm() })).status,
    403,
  );
  assert.equal(
    (
      await request(endpoint, {
        method: "POST",
        cookie: officer,
        form: uploadForm({ name: "malware.txt", bytes: Buffer.from("plain text") }),
      })
    ).status,
    415,
  );
  assert.equal(
    (
      await request(endpoint, {
        method: "POST",
        cookie: officer,
        form: uploadForm({ permitted: "false" }),
      })
    ).status,
    400,
  );
  const uploaded = await request(endpoint, {
    method: "POST",
    cookie: officer,
    form: uploadForm({
      personnelId,
      issueDate: "2026-01-10",
      expiryDate: "2027-01-10",
    }),
  });
  assert.equal(uploaded.status, 201);
  assert.equal(uploaded.data.attachment.personnel_name, "Nguyễn Văn An");
  assert.equal(uploaded.data.attachment.issue_date, "2026-01-10");
  assert.equal(uploaded.data.attachment.expiry_date, "2027-01-10");
  assert.ok(!JSON.stringify(uploaded.data).includes("storage_path"));
  const stored = db
    .prepare("SELECT * FROM attachments WHERE id=?")
    .get(uploaded.data.attachment.id);
  assert.match(stored.storage_path, /^[a-f0-9-]+\.pdf$/);
  assert.ok(existsSync(join(directory, "facility-attachments", stored.storage_path)));
  const list = await request(endpoint, { cookie: viewer });
  assert.equal(list.data.total, 1);
  assert.equal(list.data.maxFileBytes, 10 * 1024 * 1024);
  assert.deepEqual(list.data.allowedExtensions, [
    "pdf",
    "jpg",
    "jpeg",
    "png",
    "gif",
    "webp",
    "doc",
    "docx",
    "xls",
    "xlsx",
  ]);
  const view = await request(`${endpoint}/${stored.id}/view`, { cookie: viewer });
  assert.equal(view.status, 200);
  assert.equal(view.headers.get("content-disposition").startsWith("inline;"), true);
  assert.equal(view.data.subarray(0, 5).toString(), "%PDF-");
  assert.equal(stored.checksum, createHash("sha256").update(view.data).digest("hex"));
  const download = await request(`${endpoint}/${stored.id}/download`, { cookie: viewer });
  assert.equal(download.status, 200);
  assert.equal(download.headers.get("content-disposition").startsWith("attachment;"), true);
  assert.equal(
    (await request(`/api/facilities/CS003/attachments/${stored.id}/download`, { cookie: officer }))
      .status,
    404,
  );
  assert.equal(
    db
      .prepare("SELECT count(*) AS n FROM audit_logs WHERE action='facility.attachment_uploaded'")
      .get().n,
    1,
  );

  assert.equal(
    (
      await request(endpoint, {
        method: "POST",
        cookie: officer,
        form: uploadForm({ issueDate: "2027-01-10", expiryDate: "2026-01-10" }),
      })
    ).status,
    400,
  );
  assert.equal(
    (await request(`${endpoint}/${stored.id}`, { method: "DELETE", cookie: viewer })).status,
    403,
  );
  assert.equal(
    (await request(`${endpoint}/${stored.id}`, { method: "DELETE", cookie: officer })).status,
    200,
  );
  assert.ok(db.prepare("SELECT deleted_at FROM attachments WHERE id=?").get(stored.id).deleted_at);
  assert.equal((await request(endpoint, { cookie: viewer })).data.total, 0);
  assert.equal(
    (await request(`${endpoint}/${stored.id}/download`, { cookie: viewer })).status,
    404,
  );
  assert.equal(
    db
      .prepare("SELECT count(*) AS n FROM audit_logs WHERE action='facility.attachment_deleted'")
      .get().n,
    1,
  );
});

test("facility attachments accept verified Word and Excel files", async (t) => {
  const { db, request, login } = await fixture(t);
  const officer = await login("demo.can-bo");
  const endpoint = "/api/facilities/CS001/attachments";
  const files = [
    {
      name: "huan-luyen.docx",
      entries: ["[Content_Types].xml", "word/document.xml"],
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    },
    {
      name: "danh-sach.xlsx",
      entries: ["[Content_Types].xml", "xl/workbook.xml"],
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  ];

  for (const file of files) {
    const result = await request(endpoint, {
      method: "POST",
      cookie: officer,
      form: uploadForm({ name: file.name, bytes: zipContainer(file.entries) }),
    });
    assert.equal(result.status, 201);
    assert.equal(result.data.attachment.content_type, file.contentType);
    assert.match(result.data.attachment.checksum, /^[a-f0-9]{64}$/);
    const download = await request(`${endpoint}/${result.data.attachment.id}/download`, {
      cookie: officer,
    });
    assert.equal(download.status, 200);
  }
  assert.equal(
    db.prepare("SELECT count(*) AS n FROM attachments WHERE deleted_at IS NULL").get().n,
    2,
  );
});
