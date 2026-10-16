# PROJECT.md — Hệ thống Quản lý công tác PCCC & CNCH

Tài liệu sống mô tả dự án và **nhật ký các feature đã làm**. Mỗi feature mới phải ghi thêm một mục
vào [§6 Nhật ký feature](#6-nhật-ký-feature) (xem quy tắc ở [§7](#7-quy-tắc-khi-làm-feature)).

Chi tiết chạy dự án: [README.md](README.md). API và cơ chế bảo mật backend: [pccc-BE/README.md](pccc-BE/README.md).
Quy tắc nghiệp vụ/kỹ thuật: [AGENT.md](AGENT.md), [RULES.md](RULES.md), [CHECKLIST.md](CHECKLIST.md).

---

## 1. Tổng quan

Hệ thống quản lý công tác phòng cháy, chữa cháy và cứu nạn, cứu hộ cho **PC07 — Đội Khu vực 10**,
xây dựng theo `URD_He_thong_Quan_ly_PCCC_CNCH_PC07_v1.0.docx`. Môi trường demo chỉ dùng dữ liệu mẫu
(NFR-02, BR-12).

Hệ thống gồm 11 phân hệ:

| Mã  | Phân hệ                      | Mã  | Phân hệ                         |
| --- | ---------------------------- | --- | ------------------------------- |
| M01 | Quản trị & phân quyền        | M07 | Lịch, công việc, KPI            |
| M02 | Tổ chức, cán bộ, địa bàn     | M08 | Báo cáo, deadline               |
| M03 | Cơ sở & hồ sơ                | M09 | Sự cố                           |
| M04 | Vi phạm, đình chỉ, khắc phục | M10 | Tra cứu, dashboard, cảnh báo    |
| M05 | Văn bản pháp luật/quy chuẩn  | M11 | Số hóa, import/export, vận hành |
| M06 | Công tác kiểm tra            |     |                                 |

Vai trò: A01 Chỉ huy, A02 Tổ trưởng, A03 Cán bộ kiểm tra, A04 Cán bộ tổng hợp, A05 Quản trị,
A06 Người xem, A07 (chưa kích hoạt). Quyền = **RBAC** (`Mxx.view/edit…`) **+ phạm vi dữ liệu**
(`all` / `unit` / `region` / `facility`, kết hợp OR, unit bao gồm đơn vị con).

## 2. Kiến trúc

**Monorepo pnpm, kiến trúc modular monolith:** một repo chứa hai ứng dụng; backend là **một
process, một database**, chia thành các module nghiệp vụ độc lập.

```
Trình duyệt ──► pccc-FE: Next.js 16 (cổng 3000) ──/api/*──► pccc-BE: Node.js (cổng 4000) ──► SQLite
                src/proxy.ts kiểm tra session                app.js → modules/*/routes
```

| Phần    | Công nghệ                                                                                            |
| ------- | ---------------------------------------------------------------------------------------------------- |
| pccc-FE | Next.js 16 App Router, React 19, TypeScript, Tailwind v4, shadcn/ui, Recharts, react-hook-form + zod |
| pccc-BE | Node.js >= 22.13, ES modules, không dependency ngoài; SQLite qua `node:sqlite`                       |
| Auth    | Session cookie HttpOnly `pccc_session`, mật khẩu scrypt, kiểm tra Origin chống CSRF                  |
| Test    | `node:test` + `node:assert/strict`, DB `:memory:`, gọi HTTP thật                                     |
| Tooling | pnpm workspace; ESLint + Prettier dùng chung ở root; CI GitHub Actions                               |

**Quy tắc module backend:**

- Mỗi module ở `pccc-BE/src/modules/<module>/` gồm `<module>.service.js` (logic nghiệp vụ, SQL, kiểm
  tra quyền/scope) và `<module>.routes.js` (khai báo route, đọc input HTTP, gọi service).
- Route là object `{ method, path, public?, handle(ctx, match) }`; `handle` trả về body JSON (200),
  lỗi ném `ApiError`. Đăng ký routes của module trong mảng `routes` ở `pccc-BE/src/app.js`.
- `app.js` lo phần chung: CORS, kiểm tra Origin, xác thực session (mọi route không `public`, kể cả
  đường dẫn không tồn tại → 401 trước 404), xử lý lỗi.
- Module chỉ import `*.service.js` của module khác và `core/*`; không import `*.routes.js`.

> Next.js trong repo là bản có breaking change — đọc `pccc-FE/node_modules/next/dist/docs/` trước khi
> viết code frontend (xem [pccc-FE/AGENTS.md](pccc-FE/AGENTS.md)).

## 3. Cấu trúc thư mục

```
pccc/
├── pccc-FE/                 # Frontend Next.js (package pccc-fe)
│   ├── src/
│   │   ├── app/(app)/       # Màn hình trong layout có sidebar (mỗi thư mục = 1 route)
│   │   ├── app/dang-nhap, doi-mat-khau, khong-co-quyen
│   │   ├── components/      # ui/ (shadcn), layout/, shared/, forms/, charts/
│   │   ├── data/            # types.ts, mock.ts (dữ liệu hư cấu), schemas.ts (zod), thong-ke.ts
│   │   ├── lib/             # auth-contract.ts, insights-contract.ts, backend.ts, navigation.ts, utils.ts
│   │   └── proxy.ts         # Chặn route theo session/quyền
│   ├── next.config.ts, tsconfig.json, components.json, postcss.config.mjs
│   └── .env.example         # BACKEND_URL
├── pccc-BE/                 # Backend Node.js API (package pccc-be)
│   ├── migrations/          # 001-auth.sql, 003-search-dashboard.sql, 004-legal-documents-audit.sql … (không sửa migration đã phát hành)
│   ├── scripts/             # migrate.js, seed.js, check.js
│   ├── src/
│   │   ├── app.js           # Tạo HTTP server, middleware chung, đăng ký routes các module
│   │   ├── server.js        # Đọc env, mở DB, listen
│   │   ├── core/            # database, errors, validation, password, http (readJson, findRoute), seed
│   │   └── modules/
│   │       ├── auth/            # UC-ADM-01 login/logout/session/đổi mật khẩu, audit
│   │       ├── authorization/   # RBAC + bộ lọc scope dùng chung (chỉ service)
│   │       ├── administration/  # UC-ADM-03 cấu hình vai trò, tài khoản, scope, audit log
│   │       ├── facilities/      # M03 danh sách/chi tiết cơ sở theo scope
│   │       ├── search/          # UC-SYS-01 tìm kiếm toàn hệ thống
│   │       ├── dashboard/       # UC-SYS-02 dashboard
│   │       ├── audit/           # Service audit dùng chung + UC-SYS-05 nhật ký hệ thống
│   │       └── legal-documents/ # M05 kho văn bản pháp luật/quy chuẩn (UC-DOC-01/02)
│   ├── test/                # *.test.js — chạy bằng `pnpm test`
│   └── .env.example
├── tests/auth-integration.test.mjs  # Test tích hợp pccc-FE build + pccc-BE
├── scripts/format-auth.mjs  # Prettier check cho các file đã chuẩn hóa
├── .github/workflows/ci.yml
├── package.json             # Script chạy chung + tooling (eslint, prettier)
└── pnpm-workspace.yaml
```

## 4. Lệnh thường dùng (tại root)

| Mục đích                  | Lệnh                                                                |
| ------------------------- | ------------------------------------------------------------------- |
| Cài đặt                   | `pnpm install`                                                      |
| Chạy dev                  | `pnpm dev:be` + (terminal khác) `pnpm dev:fe`                       |
| Migration / seed          | `pnpm migrate` / `pnpm seed`                                        |
| Test backend              | `pnpm test`                                                         |
| Kiểm tra cú pháp backend  | `pnpm check`                                                        |
| Lint / typecheck / build  | `pnpm lint` / `pnpm typecheck` / `pnpm build`                       |
| Test tích hợp (sau build) | `pnpm test:integration`                                             |
| Format                    | `pnpm format:check`                                                 |
| Chạy riêng 1 app          | `pnpm --filter pccc-fe <script>` / `pnpm --filter pccc-be <script>` |

CI: [.github/workflows/ci.yml](.github/workflows/ci.yml) chạy toàn bộ các lệnh trên (Node 22) cho mỗi
PR và mỗi push vào `main`. PR phải xanh CI mới được merge.

## 5. Trạng thái hiện tại

- **Đã nối API thật:** đăng nhập, đổi mật khẩu, cấu hình vai trò/phạm vi (`/quan-tri/vai-tro`),
  dashboard `/`, tra cứu `/tra-cuu`, kho văn bản `/van-ban`, nhật ký `/quan-tri/nhat-ky`.
- **Còn dùng dữ liệu mẫu tĩnh:** các màn hình nghiệp vụ còn lại (`pccc-FE/src/data/mock.ts`); biểu mẫu chỉ
  log console + toast, điểm nối API ở `onSubmit`.
- **Chưa chốt với người dùng:** Q01, Q02 (ma trận quyền — grants seed chỉ là mẫu), Q04–Q12, Q15.

## 6. Nhật ký feature

Thêm mục mới **ở cuối** danh sách, theo mẫu ở §7.

### F01 — Authentication & Authorization (UC-ADM-01, UC-ADM-03)

- **Người làm / branch:** KHAI — `Feature--Authentication-&-Authorization` (PR #1)
- **Mô tả:** Đăng nhập bằng tài khoản nội bộ (Q13), session cookie HttpOnly, đổi mật khẩu lần đầu có
  nút bỏ qua, RBAC theo 7 vai trò × 11 phân hệ, phạm vi dữ liệu unit/region/facility/all, audit
  append-only, rate limit đăng nhập, chống CSRF bằng Origin.
- **Backend:** `migrations/001-auth.sql`; modules `auth`, `authorization`, `administration`,
  `facilities`; `core/password.js`, `core/validation.js`; API `/api/auth/*`, `/api/authorization/*`,
  `/api/audit-logs`, `/api/facilities`.
- **Frontend:** `/dang-nhap`, `/doi-mat-khau`, `/khong-co-quyen`, `/quan-tri/vai-tro`, `src/proxy.ts`,
  `src/lib/auth-contract.ts` (trong `pccc-FE`).
- **Test:** `pccc-BE/test/auth.test.js` (18 test: migration, seed, login/session, rate limit, CSRF,
  RBAC, scope, audit), `tests/auth-integration.test.mjs`.
- **Ghi chú:** Ma trận quyền seed chưa phải quyền chính thức (Q02).

### F02 — Global Search & Basic Dashboard (UC-SYS-01, UC-SYS-02 — SCRUM-18)

- **Người làm / branch:** HUY — `feature/SCRUM-18-global-search-dashboard`
- **Mô tả:** Tìm kiếm toàn hệ thống không dấu, nhóm kết quả theo loại (cơ sở, cán bộ, khu vực, đơn
  vị); dashboard số cơ sở/khu vực/cán bộ và phân bổ theo khu vực, theo cán bộ. Mọi số liệu lọc theo
  scope trong SQL trước count/limit.
- **Backend:** `migrations/003-search-dashboard.sql` (view `facility_overview`, `officer_directory`);
  modules `search`, `dashboard`; API `/api/search`, `/api/dashboard`,
  `/api/dashboard/facilities-by-region`, `/api/dashboard/facilities-by-officer`. Quyền M10.view
  (+ M03.view cho dữ liệu cơ sở/cán bộ).
- **Frontend (`pccc-FE`):** `src/app/(app)/page.tsx`, `src/app/(app)/tra-cuu/page.tsx`,
  `src/components/charts/dashboard-charts.tsx`, `src/lib/insights-contract.ts`.
- **Test:** `pccc-BE/test/search-dashboard.test.js` (7 test: view, tổng khớp breakdown, các loại
  scope, phân trang, tìm không dấu, không lộ dữ liệu ngoài scope, quyền và giới hạn input).
- **Ghi chú:** Tên cán bộ lấy từ bảng `accounts` đến khi có bảng cán bộ chung — khi đó chỉ thay view
  `officer_directory`.

### F03 — Legal Document & Audit Log Management (UC-DOC-01, UC-DOC-02, UC-SYS-05)

- **Người làm / branch:** KHAI — `feature/Legal-Document-&-Audit-Log-Management` (PR #4)
- **Mô tả:** Kho văn bản M05: tìm kiếm/lọc, thêm/sửa/phân loại, đính kèm PDF hoặc link, lịch sử thay
  đổi; nhật ký hệ thống đọc audit thật, lọc theo người dùng/thời gian/feature/thao tác. Chi tiết quyền
  và API ở [pccc-BE/LEGAL_DOCUMENTS.md](pccc-BE/LEGAL_DOCUMENTS.md).
- **Backend:** `migrations/004-legal-documents-audit.sql`; modules `legal-documents`, `audit`
  (`writeAudit`/`audit` dùng chung cho mọi module); API `/api/legal-documents*`,
  `/api/legal-document-categories`, `/api/audit-logs` (có bộ lọc). Seed cấp M05.
- **Frontend (`pccc-FE`):** `/van-ban` (danh sách, `[id]`, `them`, `[id]/sua`), `/quan-tri/nhat-ky`,
  `legal-document-editor.tsx`, `audit-history.tsx`, `src/lib/legal-document-*.ts`, `use-api-data.ts`.
- **Test:** `pccc-BE/test/legal-documents.test.js` (7 test: nâng cấp DB cũ, seed, quyền/scope,
  validation, PDF, lịch sử, audit), mở rộng `tests/auth-integration.test.mjs`.
- **Ghi chú:** Biến PostgreSQL trong `.env.example` chỉ là chuẩn bị, backend chưa đọc. Khi merge vào
  cấu trúc mới (F04), route của `app.js` được chuyển sang `legal-documents.routes.js`/`audit.routes.js`.

### F04 — Tái cấu trúc monorepo + modular monolith, CI, pnpm

- **Người làm / branch:** HUY — `ci` (PR #3)
- **Mô tả:** CI GitHub Actions (format, lint, typecheck, test, check, build, integration); chuyển npm
  → pnpm workspace; đổi `Backend` → `pccc-BE`, frontend vào `pccc-FE`; tách `app.js` thành routes
  theo module (`modules/*/*.routes.js`) và hạ tầng chung `core/`. Không đổi API hay hành vi.
- **Backend:** `src/core/http.js` (`readJson`, `findRoute`), `src/modules/*/`, `app.js` chỉ còn
  middleware chung + bảng routes.
- **Frontend:** chỉ di chuyển vào `pccc-FE/`, không đổi code.
- **Test:** `pccc-BE/test/router.test.js` (2 test: khớp route theo method/path/RegExp; public route,
  401 trước 404, dispatch đúng module). Toàn bộ 27 test backend + test tích hợp pass.
- **Ghi chú:** `AGENTS.md` của Next.js chuyển vào `pccc-FE/` vì `next dev` sinh file này trong thư mục
  app.

## 7. Quy tắc khi làm feature

Bắt buộc với mọi feature mới (người hoặc AI agent):

1. **Cập nhật PROJECT.md** trong cùng branch/PR: thêm một mục `### Fxx — <Tên> (<UC>, <mã Jira>)`
   vào cuối §6, cập nhật §5 nếu trạng thái thay đổi, cập nhật §3 nếu thêm file/thư mục quan trọng.
2. **Viết unit test cho feature:**
   - Backend: file `pccc-BE/test/<feature>.test.js` dùng `node:test` + `node:assert/strict`, DB
     `openDatabase(":memory:")` + `seedDemo`, theo mẫu `fixture()` trong
     `pccc-BE/test/search-dashboard.test.js`.
   - Tối thiểu phải có: luồng chính đúng; validate input/edge case; **chưa đăng nhập → 401, thiếu
     quyền → 403**; **không trả dữ liệu ngoài scope**; audit nếu feature có mutation quan trọng.
   - Bug fix phải có regression test. Không sửa test để che bug (RULES R-1001..R-1005).
3. **Chạy test thật** (`pnpm test`, cùng lint/typecheck/build nếu đụng frontend) và ghi kết quả vào
   báo cáo; chưa chạy thì ghi `NOT RUN`, không ghi `PASS`.

Mẫu mục nhật ký:

```markdown
### Fxx — <Tên feature> (<UC-...>, <SCRUM-xx>)

- **Người làm / branch:** <tên> — `<branch>`
- **Mô tả:** <làm gì, quy tắc nghiệp vụ áp dụng>
- **Backend:** <migration, module, API, quyền yêu cầu>
- **Frontend:** <route, component>
- **Test:** `<file test>` (<số test>: <nội dung chính>)
- **Ghi chú:** <giả định, điểm cần xác nhận, giới hạn>
```
