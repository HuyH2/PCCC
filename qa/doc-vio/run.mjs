import { mkdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createTestContext } from "./test-context.mjs";
import { documentCases } from "./document-cases.mjs";
import { violationCases } from "./violation-cases.mjs";

// QA only: never load .env or connect to an existing database.
if (process.env.PCCC_TEST_DATABASE_URL) {
  throw new Error("Unset PCCC_TEST_DATABASE_URL: QA requires in-memory PGlite.");
}
const out = new URL("./evidence/", import.meta.url);
mkdirSync(out, { recursive: true });
const cases = [...documentCases, ...violationCases].sort((a, b) => a.id.localeCompare(b.id));

const results = [];
for (const testCase of cases) {
  const trace = [];
  let context;
  const result = {
    ...testCase,
    run: undefined,
    startedAt: new Date().toISOString(),
    layer: "HTTP API + isolated PostgreSQL/PGlite",
  };
  try {
    context = await createTestContext(trace);
    await testCase.run(context);
    result.status = "PASS";
  } catch (error) {
    result.status = context ? "FAIL" : "BLOCKED";
    result.error = error.message;
    if (error.cause) result.cause = String(error.cause);
  } finally {
    if (context) await context.close();
  }
  result.finishedAt = new Date().toISOString();
  result.evidence = `${testCase.id}.json`;
  writeFileSync(
    new URL(result.evidence, out),
    JSON.stringify({ ...result, trace }, null, 2) + "\n",
  );
  results.push(result);
  console.log(
    `${result.status}: ${testCase.id} ${testCase.title}${result.error ? ` — ${result.error}` : ""}`,
  );
}
const report = {
  commit: execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
    windowsHide: true,
  }).trim(),
  executedAt: new Date().toISOString(),
  node: process.version,
  counts: Object.fromEntries(
    ["PASS", "FAIL", "BLOCKED"].map((s) => [s, results.filter((r) => r.status === s).length]),
  ),
  results,
};
writeFileSync(new URL("results.json", out), JSON.stringify(report, null, 2) + "\n");
const esc = (s) =>
  String(s ?? "")
    .replaceAll("|", "\\|")
    .replaceAll("\n", " ");
writeFileSync(
  new URL("./Test_Cases_DOC_VIO.md", import.meta.url),
  `# Test case và kết quả DOC/VIO\n\nCommit: \`${report.commit}\`. Node ${report.node}. Thời điểm UTC: ${report.executedAt}.\n\n${JSON.stringify(report.counts)}. Mỗi case dùng database PGlite mới, tài khoản demo và grants M04 cấu hình riêng. Không dùng dữ liệu thật. Đây là kiểm thử HTTP, không phải thao tác trình duyệt. Ánh xạ số riêng UC-VIO-01..05 chưa xác nhận vì thiếu đặc tả URD; chỉ khẳng định bao phủ nhóm nghiệp vụ.\n\n| ID | UC | Nội dung | Các bước | Kỳ vọng | Kết quả | Minh chứng |\n|---|---|---|---|---|---|---|\n` +
    results
      .map(
        (r) =>
          `| ${r.id} | ${r.uc} | ${esc(r.title)} | ${esc(r.steps)} | ${esc(r.expected)} | ${r.status}${r.error ? ": " + esc(r.error) : ""} | [JSON](evidence/${r.evidence}) |`,
      )
      .join("\n") +
    "\n",
);
console.log(JSON.stringify(report.counts));
process.exitCode = results.some((r) => r.status !== "PASS") ? 1 : 0;
