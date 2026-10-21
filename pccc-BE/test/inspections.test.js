import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { openDatabase } from "../src/core/database.js";
import { seedDemo } from "../src/core/seed.js";
import { createApp } from "../src/app.js";

const password = "Inspections-test-password-2026";
const origin = "http://localhost:3000";
const pdf = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n");
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

async function fixture(t) {
  const db = await openDatabase(":memory:");
  await seedDemo(db, password);
  await db.exec("UPDATE accounts SET must_change_password=0");
  const server = createApp(db);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await db.close();
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  async function request(path, { method = "GET", body, cookie, headers = {}, raw } = {}) {
    const response = await fetch(base + path, {
      method,
      headers: {
        Origin: origin,
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
        ...headers,
      },
      body: raw ?? (body ? JSON.stringify(body) : undefined),
    });
    const data = response.headers.get("content-type")?.includes("application/json")
      ? await response.json()
      : Buffer.from(await response.arrayBuffer());
    return { status: response.status, data, headers: response.headers };
  }
  async function login(username = "demo.can-bo") {
    const r = await request("/api/auth/login", { method: "POST", body: { username, password } });
    assert.equal(r.status, 200);
    return r.headers.get("set-cookie").split(";")[0];
  }
  const upload = (
    id,
    cookie,
    {
      kind = "record",
      file = pdf,
      type = "application/pdf",
      name = "bien-ban.pdf",
      recordNumber = "BB-01",
    } = {},
  ) =>
    request(`/api/inspections/${id}/documents`, {
      method: "POST",
      cookie,
      raw: file,
      headers: {
        "Content-Type": type,
        "X-File-Name": encodeURIComponent(name),
        "X-Document-Kind": kind,
        "X-Record-Number": encodeURIComponent(recordNumber),
      },
    });
  return { db, request, login, upload };
}

const unscheduled = (extra = {}) => ({
  facility_id: "CS001",
  kind: "unscheduled",
  reason: "Phản ánh của người dân (kiểm thử)",
  scheduled_date: "2026-10-20",
  ...extra,
});

test("migration and seed create checklists, items and sample inspections idempotently", async () => {
  const db = await openDatabase(":memory:");
  try {
    await seedDemo(db, password);
    await seedDemo(db, password);
    assert.equal((await db.prepare("SELECT count(*) AS n FROM inspection_checklists").get()).n, 2);
    assert.equal(
      (await db.prepare("SELECT count(*) AS n FROM inspection_checklist_items").get()).n,
      9,
    );
    assert.equal((await db.prepare("SELECT count(*) AS n FROM inspections").get()).n, 2);
    await assert.rejects(
      async () =>
        await db.exec(
          "INSERT INTO inspections(id,code,facility_id,kind,scheduled_date,lead_officer_id,created_by,updated_by,created_at,updated_at) VALUES ('x','y','CS001','thematic','2026-01-01','CB-A03','DEMO-A03','DEMO-A03',1,1)",
        ),
    );
    await assert.rejects(
      async () => await db.exec("UPDATE inspections SET status='completed' WHERE id='DEMO-INS-1'"),
    );
  } finally {
    await db.close();
  }
});

test("full flow: create unscheduled → checklist → record → results → conclusion → complete → follow-up", async (t) => {
  const { db, request, login, upload } = await fixture(t);
  const cookie = await login();
  const checklists = await request(
    "/api/inspection-checklists?facilityType=Nh%C3%A0%20cao%20t%E1%BA%A7ng",
    { cookie },
  );
  assert.equal(checklists.status, 200);
  assert.deepEqual(
    checklists.data.items.map((c) => c.id),
    ["CL-CHUNG", "CL-NHA-CAO-TANG"],
  );
  assert.equal((await request("/api/inspection-checklists", { cookie })).data.items.length, 2);
  const guide = await request("/api/inspection-checklists/CL-CHUNG", { cookie });
  assert.equal(guide.data.items.length, 6);
  assert.ok(guide.data.items[0].guidance);

  const created = await request("/api/inspections", {
    method: "POST",
    cookie,
    body: unscheduled(),
  });
  assert.equal(created.status, 201);
  const inspection = created.data.inspection;
  assert.match(inspection.code, /^KT-\d{4}-0001$/);
  assert.equal(inspection.status, "planned");
  assert.equal(inspection.lead_officer_id, "CB-A03");
  const id = inspection.id;

  // Uploading before execution starts is rejected (object state).
  assert.equal((await upload(id, cookie)).status, 409);

  let detail = (
    await request(`/api/inspections/${id}/results`, {
      method: "PUT",
      cookie,
      body: {
        version: 1,
        checklist_id: "CL-CHUNG",
        officer_note: "Cơ sở hợp tác",
        items: [{ item_id: "CL-CHUNG-1", status: "pass", note: "Đủ hồ sơ" }],
      },
    })
  ).data;
  assert.equal(detail.inspection.status, "in_progress");
  assert.equal(detail.inspection.officer_note, "Cơ sở hợp tác");
  assert.equal(detail.items.length, 6);
  assert.equal(detail.items[0].status, "pass");
  assert.equal(detail.items[1].status, "pending");

  // Completion blocked: required items pending, no conclusion, no record (BR-02).
  let complete = await request(`/api/inspections/${id}/complete`, {
    method: "POST",
    cookie,
    body: { version: detail.inspection.version },
  });
  assert.equal(complete.status, 409);
  assert.equal(complete.data.error.code, "INCOMPLETE_CHECKLIST");

  detail = (
    await request(`/api/inspections/${id}/results`, {
      method: "PUT",
      cookie,
      body: {
        version: detail.inspection.version,
        items: ["2", "3", "4", "5"].map((n) => ({
          item_id: `CL-CHUNG-${n}`,
          status: n === "3" ? "fail" : "pass",
          note: n === "3" ? "Bình chữa cháy hết hạn" : "",
        })),
      },
    })
  ).data;
  // Optional item 6 may stay pending.
  const conclusion = await request(`/api/inspections/${id}/conclusion`, {
    method: "PUT",
    cookie,
    body: {
      version: detail.inspection.version,
      outcome: "conditional",
      conclusion: "Khắc phục bình chữa cháy.",
    },
  });
  assert.equal(conclusion.status, 200);
  complete = await request(`/api/inspections/${id}/complete`, {
    method: "POST",
    cookie,
    body: { version: conclusion.data.inspection.version },
  });
  assert.equal(complete.data.error.code, "RESULTS_NOT_SUBMITTED");

  // "Chốt kết quả": locks the checklist and moves the inspection to 'evaluated'.
  const submitted = await request(`/api/inspections/${id}/results`, {
    method: "PUT",
    cookie,
    body: { version: conclusion.data.inspection.version, items: [], submit: true },
  });
  assert.equal(submitted.status, 200);
  assert.equal(submitted.data.inspection.status, "evaluated");
  assert.ok(submitted.data.inspection.results_submitted_at);
  assert.equal(
    submitted.data.inspection.results_submitted_by_name,
    "Cán bộ kiểm tra/Quản lý địa bàn (mẫu)",
  );
  let version = submitted.data.inspection.version;
  const locked = await request(`/api/inspections/${id}/results`, {
    method: "PUT",
    cookie,
    body: { version, items: [{ item_id: "CL-CHUNG-3", status: "pass" }] },
  });
  assert.equal(locked.status, 409);
  assert.equal(
    (await request(`/api/inspections?status=evaluated`, { cookie })).data.items[0].id,
    id,
  );
  // Conclusion stays editable after results are locked.
  const revised = await request(`/api/inspections/${id}/conclusion`, {
    method: "PUT",
    cookie,
    body: {
      version,
      outcome: "conditional",
      conclusion: "Khắc phục bình chữa cháy trong 30 ngày.",
    },
  });
  assert.equal(revised.status, 200);
  assert.equal(revised.data.inspection.status, "evaluated");
  version = revised.data.inspection.version;
  complete = await request(`/api/inspections/${id}/complete`, {
    method: "POST",
    cookie,
    body: { version },
  });
  assert.equal(complete.data.error.code, "MISSING_RECORD");

  const record = await upload(id, cookie);
  assert.equal(record.status, 201);
  assert.equal(record.data.document.record_number, "BB-01");
  const evidence = await upload(id, cookie, {
    kind: "evidence",
    file: png,
    type: "image/png",
    name: "anh.png",
  });
  assert.equal(evidence.status, 201);
  const file = await request(`/api/inspections/${id}/documents/${record.data.document.id}/file`, {
    cookie,
  });
  assert.equal(file.status, 200);
  assert.equal(file.headers.get("content-type"), "application/pdf");
  assert.deepEqual(file.data, pdf);

  complete = await request(`/api/inspections/${id}/complete`, {
    method: "POST",
    cookie,
    body: { version },
  });
  assert.equal(complete.status, 200);
  assert.equal(complete.data.inspection.status, "completed");

  // Completed inspection is read-only for results/conclusion and records.
  assert.equal(
    (
      await request(`/api/inspections/${id}/results`, {
        method: "PUT",
        cookie,
        body: { version: complete.data.inspection.version, items: [] },
      })
    ).status,
    409,
  );
  assert.equal((await upload(id, cookie)).status, 409);
  // Evidence after completion needs an open follow-up.
  assert.equal((await upload(id, cookie, { kind: "evidence" })).status, 409);

  const followUp = await request(`/api/inspections/${id}/follow-ups`, {
    method: "POST",
    cookie,
    body: { requirement: "Thay bình chữa cháy", due_date: "2026-11-20" },
  });
  assert.equal(followUp.status, 201);
  const duplicate = await request(`/api/inspections/${id}/follow-ups`, {
    method: "POST",
    cookie,
    body: { requirement: "Lặp", due_date: "2026-11-20" },
  });
  assert.equal(duplicate.data.error.code, "DUPLICATE_FOLLOW_UP");
  const followEvidence = await upload(id, cookie, { kind: "evidence", name: "khac-phuc.pdf" });
  assert.equal(followEvidence.status, 201);
  assert.equal(followEvidence.data.document.follow_up_id, followUp.data.followUp.id);

  const done = await request(`/api/inspections/${id}/follow-ups/${followUp.data.followUp.id}`, {
    method: "PUT",
    cookie,
    body: { outcome: "resolved", result_note: "Đã thay bình mới" },
  });
  assert.equal(done.status, 200);
  assert.equal(done.data.followUp.status, "completed");
  assert.equal(
    (
      await request(`/api/inspections/${id}/follow-ups/${followUp.data.followUp.id}`, {
        method: "PUT",
        cookie,
        body: { outcome: "resolved", result_note: "Lần hai" },
      })
    ).status,
    409,
  );

  detail = (await request(`/api/inspections/${id}`, { cookie })).data;
  assert.equal(detail.documents.length, 3);
  assert.equal(detail.followUps.length, 1);
  assert.equal(detail.items.find((i) => i.id === "CL-CHUNG-3").note, "Bình chữa cháy hết hạn");

  const actions = (
    await db
      .prepare(
        "SELECT action FROM audit_logs WHERE object_type='inspection' AND object_id=? ORDER BY id",
      )
      .all(id)
  ).map((r) => r.action);
  assert.deepEqual(actions, [
    "inspection.created",
    "inspection.results_saved",
    "inspection.results_saved",
    "inspection.conclusion_updated",
    "inspection.results_submitted",
    "inspection.conclusion_updated",
    "inspection.document_uploaded",
    "inspection.document_uploaded",
    "inspection.completed",
    "inspection.follow_up_created",
    "inspection.document_uploaded",
    "inspection.follow_up_completed",
  ]);
  const audit = await db
    .prepare(
      "SELECT actor_id,feature,after_json FROM audit_logs WHERE action='inspection.document_uploaded' LIMIT 1",
    )
    .get();
  assert.equal(audit.actor_id, "DEMO-A03");
  assert.equal(audit.feature, "M06");
  assert.ok(!audit.after_json.includes("file_data"));
});

test("thematic inspection requires a topic; inputs and state transitions are validated", async (t) => {
  const { request, login, upload } = await fixture(t);
  const cookie = await login();
  const post = (body) => request("/api/inspections", { method: "POST", cookie, body });
  for (const body of [
    unscheduled({ kind: "thematic" }),
    unscheduled({ kind: "periodic" }),
    unscheduled({ topic: "Không dùng cho đột xuất" }),
    unscheduled({ reason: "  " }),
    unscheduled({ scheduled_date: "2026-02-30" }),
    unscheduled({ checklist_id: "KHONG-CO" }),
    unscheduled({ lead_officer_id: "CB-KHONG-CO" }),
    unscheduled({ extra: 1 }),
  ])
    assert.equal((await post(body)).status, 400, JSON.stringify(body));
  const thematic = await post(
    unscheduled({ kind: "thematic", topic: "Chuyên đề karaoke", checklist_id: "CL-CHUNG" }),
  );
  assert.equal(thematic.status, 201);
  assert.equal(thematic.data.inspection.topic, "Chuyên đề karaoke");
  assert.equal(
    thematic.data.inspection.checklist_name,
    "Checklist kiểm tra an toàn PCCC chung (mẫu)",
  );
  const id = thematic.data.inspection.id;

  const results = (body) =>
    request(`/api/inspections/${id}/results`, {
      method: "PUT",
      cookie,
      body: { version: 1, ...body },
    });
  assert.equal(
    (await results({ items: [{ item_id: "CL-NHA-CAO-TANG-1", status: "pass" }] })).status,
    400,
  );
  assert.equal((await results({ items: [{ item_id: "CL-CHUNG-1", status: "ok" }] })).status, 400);
  assert.equal(
    (
      await results({
        items: [
          { item_id: "CL-CHUNG-1", status: "pass" },
          { item_id: "CL-CHUNG-1", status: "fail" },
        ],
      })
    ).status,
    400,
  );
  assert.equal((await results({ version: 99 })).status, 409);
  assert.equal((await results({ submit: "yes" })).status, 400);
  const early = await results({ items: [{ item_id: "CL-CHUNG-1", status: "pass" }], submit: true });
  assert.equal(early.data.error.code, "INCOMPLETE_CHECKLIST");
  const saved = await results({ items: [{ item_id: "CL-CHUNG-1", status: "fail" }] });
  assert.equal(saved.status, 200);
  // Checklist cannot be swapped once results exist.
  assert.equal(
    (await results({ version: saved.data.inspection.version, checklist_id: "CL-NHA-CAO-TANG" }))
      .status,
    409,
  );
  assert.equal(
    (
      await request(`/api/inspections/${id}/conclusion`, {
        method: "PUT",
        cookie,
        body: { version: saved.data.inspection.version, outcome: "bad", conclusion: "x" },
      })
    ).status,
    400,
  );
  // Follow-up before completion is rejected.
  assert.equal(
    (
      await request(`/api/inspections/${id}/follow-ups`, {
        method: "POST",
        cookie,
        body: { requirement: "x", due_date: "2026-12-01" },
      })
    ).status,
    409,
  );
  // File type whitelist, content sniffing, record number.
  assert.equal((await upload(id, cookie, { type: "text/plain", name: "a.txt" })).status, 415);
  assert.equal((await upload(id, cookie, { file: png, name: "gia.pdf" })).status, 400);
  assert.equal((await upload(id, cookie, { name: "sai.png" })).status, 400);
  assert.equal((await upload(id, cookie, { recordNumber: "" })).status, 400);
  assert.equal((await upload(id, cookie, { kind: "other" })).status, 400);
  const big = Buffer.concat([pdf, Buffer.alloc(6 * 1024 * 1024)]);
  assert.equal((await upload(id, cookie, { file: big })).status, 413);
  assert.equal((await request("/api/inspections?status=bogus", { cookie })).status, 400);
});

test("APIs require a session (401) and M06 permissions (403)", async (t) => {
  const { db, request, login, upload } = await fixture(t);
  for (const path of [
    "/api/inspections",
    "/api/inspection-checklists",
    "/api/inspections/DEMO-INS-1",
  ])
    assert.equal((await request(path)).status, 401);
  assert.equal(
    (await request("/api/inspections", { method: "POST", body: unscheduled() })).status,
    401,
  );

  const admin = await login("demo.admin"); // A05: no M06 grant in the sample matrix.
  assert.equal((await request("/api/inspections", { cookie: admin })).status, 403);
  assert.equal((await request("/api/inspection-checklists", { cookie: admin })).status, 403);

  const viewer = await login("demo.nguoi-xem"); // A06: view only, scope all.
  assert.equal((await request("/api/inspections", { cookie: viewer })).data.total, 2);
  assert.equal((await request("/api/inspections/DEMO-INS-1", { cookie: viewer })).status, 200);
  assert.equal(
    (await request("/api/inspections", { method: "POST", cookie: viewer, body: unscheduled() }))
      .status,
    403,
  );
  assert.equal(
    (
      await request("/api/inspections/DEMO-INS-1/results", {
        method: "PUT",
        cookie: viewer,
        body: { version: 1, items: [] },
      })
    ).status,
    403,
  );
  assert.equal((await upload("DEMO-INS-1", viewer)).status, 403);

  const commander = await login("demo.chi-huy"); // A01: create but not edit in the sample.
  assert.equal(
    (await request("/api/inspections", { method: "POST", cookie: commander, body: unscheduled() }))
      .status,
    201,
  );
  assert.equal(
    (
      await request("/api/inspections/DEMO-INS-1/conclusion", {
        method: "PUT",
        cookie: commander,
        body: { version: 1, outcome: "pass", conclusion: "x" },
      })
    ).status,
    403,
  );
  await db.exec("UPDATE accounts SET must_change_password=1 WHERE id='DEMO-A03'");
  const pending = await login("demo.can-bo");
  assert.equal(
    (await request("/api/inspections", { cookie: pending })).data?.error?.code,
    "PASSWORD_CHANGE_REQUIRED",
  );
});

test("data scope: list, detail, files and mutations never reach out-of-scope facilities", async (t) => {
  const { db, request, login, upload } = await fixture(t);
  const officer = await login("demo.can-bo"); // A03: region KP01 → CS001 only.
  const list = await request("/api/inspections", { cookie: officer });
  assert.deepEqual(
    list.data.items.map((i) => i.facility_id),
    ["CS001"],
  );
  assert.equal(list.data.total, 1);
  assert.equal((await request("/api/inspections/DEMO-INS-2", { cookie: officer })).status, 404);
  assert.equal(
    (
      await request("/api/inspections/DEMO-INS-2/results", {
        method: "PUT",
        cookie: officer,
        body: { version: 1, items: [] },
      })
    ).status,
    404,
  );
  assert.equal((await upload("DEMO-INS-2", officer)).status, 404);
  assert.equal(
    (
      await request("/api/inspections", {
        method: "POST",
        cookie: officer,
        body: unscheduled({ facility_id: "CS002" }),
      })
    ).status,
    404,
  );

  // Teammate A02 (unit DV-KV10) uploads into CS002; A03 still cannot download it.
  const leader = await login("demo.to-truong");
  await request("/api/inspections/DEMO-INS-2/results", {
    method: "PUT",
    cookie: leader,
    body: { version: 1, items: [{ item_id: "CL-CHUNG-1", status: "pass" }] },
  });
  const document = (await upload("DEMO-INS-2", leader)).data.document;
  assert.equal(
    (
      await request(`/api/inspections/DEMO-INS-2/documents/${document.id}/file`, {
        cookie: officer,
      })
    ).status,
    404,
  );
  // Document id paired with a different (visible) inspection is not served either.
  assert.equal(
    (
      await request(`/api/inspections/DEMO-INS-1/documents/${document.id}/file`, {
        cookie: officer,
      })
    ).status,
    404,
  );
  assert.equal((await request("/api/inspections", { cookie: leader })).data.total, 2);
  // Empty scope sees nothing.
  await db.exec("DELETE FROM account_scopes WHERE account_id='DEMO-A03'");
  const empty = await request("/api/inspections", { cookie: officer });
  assert.equal(empty.data.total, 0);
  assert.equal((await request("/api/inspections/DEMO-INS-1", { cookie: officer })).status, 404);
});

test("UC-INS-06: only commanders (A01) and deputies (A02) create checklists", async (t) => {
  const { db, request, login } = await fixture(t);
  const checklist = (extra = {}) => ({
    name: "Checklist karaoke (kiểm thử)",
    facility_type: "Karaoke",
    description: "Dữ liệu kiểm thử",
    legal_document_id: "DEMO-DOC-1",
    items: [
      { content: "Lối thoát nạn", guidance: "Kiểm tra cửa", legal_reference: "Mẫu" },
      { content: "Vật liệu cách âm", is_required: false },
    ],
    ...extra,
  });
  const post = (cookie, body = checklist()) =>
    request("/api/inspection-checklists", { method: "POST", cookie, body });

  assert.equal((await post(undefined)).status, 401);
  // A03 holds M06.create (to create inspections) but is not a checklist author.
  assert.equal((await post(await login("demo.can-bo"))).status, 403);
  assert.equal((await post(await login("demo.nguoi-xem"))).status, 403);
  assert.equal((await post(await login("demo.admin"))).status, 403);

  const commander = await login("demo.chi-huy");
  const created = await post(commander);
  assert.equal(created.status, 201);
  assert.equal(created.data.checklist.legal_document_title.length > 0, true);
  assert.deepEqual(
    created.data.items.map((i) => [i.position, i.content, i.is_required]),
    [
      [1, "Lối thoát nạn", 1],
      [2, "Vật liệu cách âm", 0],
    ],
  );
  const id = created.data.checklist.id;
  const row = await db.prepare("SELECT created_by FROM inspection_checklists WHERE id=?").get(id);
  assert.equal(row.created_by, "DEMO-A01");
  const audit = await db
    .prepare("SELECT actor_id,feature FROM audit_logs WHERE action='inspection_checklist.created'")
    .get();
  assert.deepEqual({ ...audit }, { actor_id: "DEMO-A01", feature: "M06" });

  // Duplicate name for the same facility type (case-insensitive) is rejected.
  assert.equal(
    (await post(commander, checklist({ name: "CHECKLIST KARAOKE (KIỂM THỬ)" }))).data.error.code,
    "DUPLICATE_CHECKLIST",
  );
  const deputy = await login("demo.to-truong");
  assert.equal((await post(deputy, checklist({ facility_type: "Nhà cao tầng" }))).status, 201);

  for (const body of [
    checklist({ items: [] }),
    checklist({ name: " " }),
    checklist({ legal_document_id: "KHONG-CO" }),
    checklist({ items: [{ content: "" }] }),
    checklist({ items: [{ content: "x", is_required: "yes" }] }),
    checklist({ extra: 1 }),
  ])
    assert.equal((await post(deputy, body)).status, 400, JSON.stringify(body));

  // New checklists are usable: listed for their facility type and selectable on an inspection.
  const officer = await login("demo.can-bo");
  const karaoke = await request("/api/inspection-checklists?facilityType=Karaoke", {
    cookie: officer,
  });
  assert.ok(karaoke.data.items.some((c) => c.id === id));
  const results = await request("/api/inspections/DEMO-INS-1/results", {
    method: "PUT",
    cookie: officer,
    body: { version: 1, checklist_id: id, items: [] },
  });
  assert.equal(results.status, 200);
  assert.equal(results.data.items.length, 2);
});
