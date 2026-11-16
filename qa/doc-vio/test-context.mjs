import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { openDatabase } from "../../pccc-BE/src/core/database.js";
import { seedDemo } from "../../pccc-BE/src/core/seed.js";
import { createApp } from "../../pccc-BE/src/app.js";
import { violationPayload, suspensionPayload, sampleEvidence } from "./test-data.mjs";

// Each case owns its database, server and authenticated sessions.
export async function createTestContext(trace) {
  const db = await openDatabase(":memory:");
  const password = randomBytes(24).toString("hex");
  let server;
  try {
    await seedDemo(db, password);
    await db.exec("UPDATE accounts SET must_change_password=0");
    // Explicit test grants, not a proposed production role matrix (Q02).
    for (const [role, actions] of [
      ["A01", ["view", "create", "edit", "approve"]],
      ["A03", ["view", "create", "edit"]],
      ["A05", ["view", "create", "edit", "approve"]],
    ])
      for (const permissionAction of actions)
        await db
          .prepare("INSERT INTO role_permissions VALUES (?,?) ON CONFLICT DO NOTHING")
          .run(role, `M04.${permissionAction}`);
    server = createApp(db);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const base = `http://127.0.0.1:${server.address().port}`;
    const cookies = {};
    async function request(path, method = "GET", body, actor = "officer") {
      const response = await fetch(base + path, {
        method,
        headers: {
          Origin: "http://localhost:3000",
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
          ...(cookies[actor] ? { Cookie: cookies[actor] } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const data = response.headers.get("content-type")?.includes("application/json")
        ? await response.json()
        : { bytes: Buffer.from(await response.arrayBuffer()).toString("base64") };
      if (path !== "/api/auth/login")
        trace.push({ actor, method, path, request: body, status: response.status, response: data });
      return {
        status: response.status,
        data,
        cookie: response.headers.get("set-cookie")?.split(";")[0],
      };
    }
    for (const [actor, username] of [
      ["officer", "demo.can-bo"],
      ["commander", "demo.chi-huy"],
      ["admin", "demo.admin"],
    ]) {
      const response = await request(
        "/api/auth/login",
        "POST",
        { username, password },
        "anonymous",
      );
      assert.equal(response.status, 200, "Fixture login failed");
      cookies[actor] = response.cookie;
    }
    const requestSuccess = async (path, method, body, actor, status = 200) => {
      const response = await request(path, method, body, actor);
      assert.equal(
        response.status,
        status,
        `${method ?? "GET"} ${path}: ${JSON.stringify(response.data)}`,
      );
      return response.data;
    };
    const createViolation = async (extra) =>
      (await requestSuccess("/api/violations", "POST", violationPayload(extra), "officer", 201))
        .violation.id;
    const performViolationAction = (
      id,
      suffix,
      body,
      actor = "officer",
      status = 200,
      method = "POST",
    ) => requestSuccess(`/api/violations/${id}/${suffix}`, method, body, actor, status);
    const prepareRemediationCase = async ({
      suspend = true,
      upload = true,
      submit = true,
      extra,
    } = {}) => {
      const id = await createViolation(extra);
      if (suspend)
        await performViolationAction(id, "suspension", suspensionPayload, "officer", 201);
      await performViolationAction(
        id,
        "remediation",
        { note: "Đã khắc phục để kiểm thử", progress: 100 },
        "officer",
        201,
      );
      if (upload) await performViolationAction(id, "evidences", sampleEvidence, "officer", 201);
      if (submit) await performViolationAction(id, "submit-approval", {});
      return id;
    };
    return {
      db,
      request,
      requestSuccess,
      createViolation,
      performViolationAction,
      prepareRemediationCase,
      close: async () => {
        await new Promise((resolve) => server.close(resolve));
        await db.close();
      },
    };
  } catch (error) {
    if (server?.listening) await new Promise((resolve) => server.close(resolve));
    await db.close();
    throw error;
  }
}
