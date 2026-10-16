# PROJECT.md — Hệ thống Quản lý công tác PCCC & CNCH

Tài liệu sống mô tả dự án và **nhật ký các feature đã làm**. Mỗi feature mới phải ghi thêm một mục
vào [§6 Nhật ký feature](#6-nhật-ký-feature) (xem quy tắc ở [§7](#7-quy-tắc-khi-làm-feature)).

Chi tiết chạy dự án: [README.md](README.md). API và cơ chế bảo mật backend: [Backend/README.md](Backend/README.md).
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

```
Trình duyệt ──► Next.js 16 (cổng 3000) ──/api/*──► Backend Node.js (cổng 4000) ──► SQLite
                 src/proxy.ts kiểm tra session          node:http + node:sqlite
```

| Phần     | Công nghệ                                                                                            |
| -------- | ---------------------------------------------------------------------------------------------------- |
| Frontend | Next.js 16 App Router, React 19, TypeScript, Tailwind v4, shadcn/ui, Recharts, react-hook-form + zod |
| Backend  | Node.js >= 22.13, ES modules, không dependency ngoài; SQLite qua `node:sqlite`                       |
| Auth     | Session cookie HttpOnly `pccc_session`, mật khẩu scrypt, kiểm tra Origin chống CSRF                  |
| Test     | `node:test` + `node:assert/strict`, DB `:memory:`, gọi HTTP thật                                     |

> Next.js trong repo là bản có breaking change — đọc `node_modules/next/dist/docs/` trước khi viết
> code frontend (xem [AGENTS.md](AGENTS.md)).

## 3. Cấu trúc thư mục

```
Backend/
├── migrations/        # 001-auth.sql, 003-search-dashboard.sql … (không sửa migration đã phát hành)
├── scripts/           # migrate.js, seed.js, check.js
├── src/
│   ├── app.js           # Router HTTP, nối các handler
│   ├── authentication.js# Login/logout/session/đổi mật khẩu
│   ├── authorization.js # RBAC + bộ lọc scope dùng chung
│   ├── administration.js# API cấu hình vai trò/tài khoản/audit
│   ├── dashboard.js     # UC-SYS-02
│   ├── search.js        # UC-SYS-01
│   ├── database.js, validation.js, errors.js, password.js, seed.js, server.js
└── test/              # *.test.js — chạy bằng `npm test`
src/
├── app/(app)/         # Màn hình trong layout có sidebar (mỗi thư mục = 1 route)
├── app/dang-nhap, doi-mat-khau, khong-co-quyen
├── components/        # ui/ (shadcn), layout/, shared/, forms/, charts/
├── data/              # types.ts, mock.ts (dữ liệu hư cấu), schemas.ts (zod), thong-ke.ts
├── lib/               # auth-contract.ts, insights-contract.ts, backend.ts, navigation.ts, utils.ts
└── proxy.ts           # Chặn route theo session/quyền
tests/auth-integration.test.mjs   # Test tích hợp frontend build + backend
```

## 4. Lệnh thường dùng (tại root)

| Mục đích                  | Lệnh                                                                 |
| ------------------------- | -------------------------------------------------------------------- |
| Chạy dev                  | `cd Backend && npm run dev` + (terminal khác) `npm run dev`          |
| Migration / seed          | `npm --prefix Backend run migrate` / `npm --prefix Backend run seed` |
| Test backend              | `npm test`                                                           |
| Kiểm tra backend          | `npm --prefix Backend run check`                                     |
| Lint / typecheck / build  | `npm run lint` / `npm run typecheck` / `npm run build`               |
| Test tích hợp (sau build) | `npm run test:integration`                                           |
| Format                    | `npm run format:check`                                               |

CI: [.github/workflows/ci.yml](.github/workflows/ci.yml) chạy toàn bộ các lệnh trên (Node 22) cho mỗi
PR và mỗi push vào `main`. PR phải xanh CI mới được merge.

## 5. Trạng thái hiện tại

- **Đã nối API thật:** đăng nhập, đổi mật khẩu, cấu hình vai trò/phạm vi (`/quan-tri/vai-tro`),
  dashboard `/`, tra cứu `/tra-cuu`.
- **Còn dùng dữ liệu mẫu tĩnh:** các màn hình nghiệp vụ còn lại (`src/data/mock.ts`); biểu mẫu chỉ
  log console + toast, điểm nối API ở `onSubmit`.
- **Chưa chốt với người dùng:** Q01, Q02 (ma trận quyền — grants seed chỉ là mẫu), Q04–Q12, Q15.

## 6. Nhật ký feature

Thêm mục mới **ở cuối** danh sách, theo mẫu ở §7.

### F01 — Authentication & Authorization (UC-ADM-01, UC-ADM-03)

- **Người làm / branch:** KHAI — `Feature--Authentication-&-Authorization` (PR #1)
- **Mô tả:** Đăng nhập bằng tài khoản nội bộ (Q13), session cookie HttpOnly, đổi mật khẩu lần đầu có
  nút bỏ qua, RBAC theo 7 vai trò × 11 phân hệ, phạm vi dữ liệu unit/region/facility/all, audit
  append-only, rate limit đăng nhập, chống CSRF bằng Origin.
- **Backend:** `migrations/001-auth.sql`; `authentication.js`, `authorization.js`,
  `administration.js`, `password.js`, `validation.js`; API `/api/auth/*`, `/api/authorization/*`,
  `/api/audit-logs`, `/api/facilities`.
- **Frontend:** `/dang-nhap`, `/doi-mat-khau`, `/khong-co-quyen`, `/quan-tri/vai-tro`, `src/proxy.ts`,
  `src/lib/auth-contract.ts`.
- **Test:** `Backend/test/auth.test.js` (18 test: migration, seed, login/session, rate limit, CSRF,
  RBAC, scope, audit), `tests/auth-integration.test.mjs`.
- **Ghi chú:** Ma trận quyền seed chưa phải quyền chính thức (Q02).

### F02 — Global Search & Basic Dashboard (UC-SYS-01, UC-SYS-02 — SCRUM-18)

- **Người làm / branch:** HUY — `feature/SCRUM-18-global-search-dashboard`
- **Mô tả:** Tìm kiếm toàn hệ thống không dấu, nhóm kết quả theo loại (cơ sở, cán bộ, khu vực, đơn
  vị); dashboard số cơ sở/khu vực/cán bộ và phân bổ theo khu vực, theo cán bộ. Mọi số liệu lọc theo
  scope trong SQL trước count/limit.
- **Backend:** `migrations/003-search-dashboard.sql` (view `facility_overview`, `officer_directory`);
  `search.js`, `dashboard.js`; API `/api/search`, `/api/dashboard`,
  `/api/dashboard/facilities-by-region`, `/api/dashboard/facilities-by-officer`. Quyền M10.view
  (+ M03.view cho dữ liệu cơ sở/cán bộ).
- **Frontend:** `src/app/(app)/page.tsx`, `src/app/(app)/tra-cuu/page.tsx`,
  `src/components/charts/dashboard-charts.tsx`, `src/lib/insights-contract.ts`.
- **Test:** `Backend/test/search-dashboard.test.js` (7 test: view, tổng khớp breakdown, các loại
  scope, phân trang, tìm không dấu, không lộ dữ liệu ngoài scope, quyền và giới hạn input).
- **Ghi chú:** Tên cán bộ lấy từ bảng `accounts` đến khi có bảng cán bộ chung — khi đó chỉ thay view
  `officer_directory`.

## 7. Quy tắc khi làm feature

Bắt buộc với mọi feature mới (người hoặc AI agent):

1. **Cập nhật PROJECT.md** trong cùng branch/PR: thêm một mục `### Fxx — <Tên> (<UC>, <mã Jira>)`
   vào cuối §6, cập nhật §5 nếu trạng thái thay đổi, cập nhật §3 nếu thêm file/thư mục quan trọng.
2. **Viết unit test cho feature:**
   - Backend: file `Backend/test/<feature>.test.js` dùng `node:test` + `node:assert/strict`, DB
     `openDatabase(":memory:")` + `seedDemo`, theo mẫu `fixture()` trong
     `Backend/test/search-dashboard.test.js`.
   - Tối thiểu phải có: luồng chính đúng; validate input/edge case; **chưa đăng nhập → 401, thiếu
     quyền → 403**; **không trả dữ liệu ngoài scope**; audit nếu feature có mutation quan trọng.
   - Bug fix phải có regression test. Không sửa test để che bug (RULES R-1001..R-1005).
3. **Chạy test thật** (`npm test`, cùng lint/typecheck/build nếu đụng frontend) và ghi kết quả vào
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
