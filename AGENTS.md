# Hướng dẫn agent cho PCCC & CNCH

Áp dụng cho toàn repository. Đọc tài liệu này trước khi sửa; `CLAUDE.md` hiện tham chiếu tới đây.
Quy định riêng của Next.js (khối `nextjs-agent-rules` do `next dev` tự quản lý) nằm ở
`pccc-FE/AGENTS.md`. Kiến trúc, cấu trúc thư mục và nhật ký feature xem `PROJECT.md`.

## Ngữ cảnh và nguồn yêu cầu

- Đây là hệ thống quản lý công tác PCCC & CNCH cho PC07/Đội Khu vực 10, gồm các phân hệ M01–M11.
- Trước khi code, đọc `AGENT.md`, `RULES.md`, `CHECKLIST.md`, sau đó đọc source, test,
  migration và contract liên quan. Tài liệu này bổ sung chỉ dẫn kỹ thuật, không thay thế các quy tắc đó.
- Về nghiệp vụ, ưu tiên yêu cầu người dùng, URD hiện hành và các quyết định đã xác nhận theo
  `AGENT.md`. URD được README nhắc tới nhưng chưa có trong cây file khảo sát; không khẳng định
  đã đọc URD nếu chưa truy cập được tài liệu thực tế.
- Về trạng thái triển khai, kiểm chứng bằng source và test hiện tại. README và
  `pccc-BE/VERIFICATION.md` có thông tin lịch sử, không phải bằng chứng kiểm thử của lần làm việc mới.
- Không biến điểm “Cần xác nhận” thành quy tắc cứng. Q02 là ma trận quyền mẫu, Q04 là bộ trường
  đề xuất; yêu cầu xác nhận nếu quyết định còn thiếu ảnh hưởng lớn tới dữ liệu, quyền hoặc pháp lý.
- Giữ các quyết định đã ghi nhận: mỗi khu phố/cơ sở có một cán bộ phụ trách (Q03), tài khoản nội bộ
  và đề nghị đổi mật khẩu lần đầu có thể bỏ qua (Q13), web responsive trong giai đoạn đầu (Q14).

## Stack và bản đồ mã nguồn

Monorepo pnpm (`pnpm-workspace.yaml`) gồm hai ứng dụng; backend theo modular monolith.

- Frontend `pccc-FE`: Next.js 16 App Router, React 19, TypeScript strict.
- UI: Tailwind CSS v4, shadcn/ui + Radix, lucide-react, Recharts; form dùng react-hook-form + Zod.
- Backend `pccc-BE`: JavaScript ESM, `node:http`, `node:sqlite` với `DatabaseSync`; Node.js >= 22.13.0.
  Backend hiện không có dependency riêng, ORM hoặc Express.
- Package manager: pnpm (phiên bản ghim ở `packageManager` của `package.json` root), `pnpm-lock.yaml`.
- Các đường dẫn `src/...` dưới đây (frontend) nằm trong `pccc-FE/`:
- `src/app/(app)/`: các trang trong khung sidebar/header. Route group không xuất hiện trong URL.
- `src/app/dang-nhap`, `doi-mat-khau`, `khong-co-quyen`: các luồng xác thực ngoài khung ứng dụng.
- `src/proxy.ts`: kiểm tra session và điều hướng trước khi vào trang; không thay thế quyền ở API.
- `src/lib/backend.ts`: server fetch chuyển cookie session, `currentUser`, `requirePage`.
- `src/lib/auth-contract.ts`, `insights-contract.ts`, `legal-document-contract.ts`: kiểu dữ liệu
  auth, scope, search/dashboard, văn bản.
- `src/lib/navigation.ts`: cây điều hướng, breadcrumb và ánh xạ phân hệ/use case.
- `src/components/ui`, `shared`, `layout`, `forms`, `charts`: primitive và component tái sử dụng.
- `src/data/types.ts`, `schemas.ts`: type nghiệp vụ và validation form; `mock.ts`, `thong-ke.ts`
  chứa dữ liệu/tổng hợp demo, không phải nguồn dữ liệu production.
- `pccc-BE/src/app.js`: HTTP server, middleware chung (CORS, Origin, session, lỗi) và bảng routes.
- `pccc-BE/src/core/`: `database.js` (SQLite, transaction, migration), `errors.js`, `validation.js`,
  `password.js`, `http.js` (`readJson`, `findRoute`), seed demo.
- `pccc-BE/src/modules/<module>/`: `<module>.service.js` (logic, SQL, quyền/scope) và
  `<module>.routes.js` (route HTTP). Module hiện có: `auth`, `authorization` (RBAC + scope dùng
  chung), `administration`, `facilities`, `search`, `dashboard`, `audit` (service audit chung + nhật
  ký), `legal-documents` (kho văn bản M05; hợp đồng API, PDF và quyền ở `pccc-BE/LEGAL_DOCUMENTS.md`).
- `pccc-BE/migrations/*.sql`: migration theo thứ tự tên file.
- `pccc-BE/test/*.test.js`: kiểm thử bằng `node:test`, HTTP và SQLite; `tests/auth-integration.test.mjs`:
  tích hợp frontend production với backend.

## Luồng dữ liệu và ranh giới triển khai

- Browser gọi `/api/*`; `next.config.ts` rewrite tới `BACKEND_URL` (mặc định cổng 4000).
  Server Components gọi backend qua `backendFetch`, chuyển cookie `pccc_session` và dùng `no-store`.
- Backend xác thực session, kiểm quyền/phạm vi, validate input rồi truy vấn SQLite. Lỗi API có dạng
  `{ error: { code, message } }`; giữ semantics 401/403/404 và không trả stack trace/secret.
- Đăng nhập, đổi/bỏ qua đổi mật khẩu, cấu hình vai trò/phạm vi, dashboard `/` và tra cứu `/tra-cuu`
  đã có luồng API. Backend có API đọc cơ sở, nhưng trang `/co-so` hiện vẫn dùng dữ liệu demo.
- Kho `/van-ban` (danh sách/chi tiết/thêm/sửa/PDF/lịch sử) và `/quan-tri/nhat-ky` đã nối API thật.
  Kho chung đọc theo M05.view + scope không rỗng; ghi cần quyền tạo/sửa + scope all.
  Nhật ký hệ thống giữ giới hạn A05 + M01.view + all; history văn bản theo quyền đọc văn bản.
- Nhiều màn hình nghiệp vụ và form còn mock. Khi được giao tích hợp thật, làm đủ DB → API → quyền
  → UI → validation → test; không báo hoàn thành dựa trên toast hoặc thay đổi state cục bộ.
- `canVisit` giới hạn trang vai trò/phạm vi, nhật ký và kho văn bản; không suy diễn rằng mọi route đã được
  phân quyền đầy đủ. Kiểm tra độc lập từng API và trang khi mở rộng feature.

## Môi trường và database

- Frontend đọc `.env*` trong `pccc-FE`; backend chạy với `--env-file-if-exists=.env` trong `pccc-BE`.
  Không ghi đè cấu hình có sẵn; chỉ tạo từ `.env.example` khi file đích chưa tồn tại.
- Frontend dùng `BACKEND_URL`. Backend dùng `PORT`, `HOST`, `DATABASE_PATH`, `APP_ORIGIN`,
  `SESSION_TTL_SECONDS`, `COOKIE_SECURE`, `DEMO_PASSWORD`, `LEGAL_DOCUMENT_MAX_BYTES`; xem các file `.env.example`.
- `DATABASE_URL`, `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`, `PGSSLMODE` đã có
  trong template để chuẩn bị PostgreSQL, nhưng hiện chưa được backend đọc. Thêm biến không chuyển
  database; nếu được giao chuyển PostgreSQL phải xử lý driver, query, migration, seed và test.
- SQLite mặc định nằm ở `pccc-BE/data/pccc.sqlite` (script backend chạy trong thư mục `pccc-BE`).
  Migration SQL được chạy theo tên đã sắp xếp, ghi nhận trong `schema_migrations`.
- Thêm migration mới cho schema mới; không sửa migration đã phát hành. Dùng constraint,
  parameterized query và transaction cho nhiều thao tác ghi liên quan.
- Seed demo yêu cầu `DEMO_PASSWORD` hợp lệ, bị chặn trong production và không reset mật khẩu/quyền
  đã có. Không chạy seed/migrate lên dữ liệu thật chỉ để kiểm thử.
- Không commit `.env*` chứa credential, SQLite hoặc log nhạy cảm. Chỉ giữ placeholder trong
  `.env.example`; không thêm tiền tố `NEXT_PUBLIC_` cho biến database hoặc secret.

## Lệnh làm việc

Chạy các lệnh sau tại root, trừ khi có ghi chú khác:

| Mục đích                   | Lệnh / điều kiện                                       |
| -------------------------- | ------------------------------------------------------ |
| Cài dependency             | `pnpm install --frozen-lockfile`                       |
| Frontend dev               | `pnpm dev:fe` — cổng 3000                              |
| Backend dev                | `pnpm dev:be` — cổng 4000                              |
| Khởi tạo schema            | `pnpm migrate`                                         |
| Seed demo local            | `pnpm seed`                                            |
| Kiểm format phạm vi script | `pnpm format:check`                                    |
| Format phạm vi script      | `pnpm format:auth` — xem danh sách file trước khi dùng |
| Lint                       | `pnpm lint`                                            |
| TypeScript                 | `pnpm typecheck`                                       |
| Backend syntax             | `pnpm check`                                           |
| Backend tests              | `pnpm test`                                            |
| Frontend build             | `pnpm build`                                           |
| Frontend production        | `pnpm start:fe` — cần build và backend đang chạy       |
| Tích hợp frontend/backend  | `pnpm test:integration` — cần build trước              |

- `APP_ORIGIN` local mặc định là `http://localhost:3000`, phải khớp origin frontend chính xác.
  Production yêu cầu HTTPS và `COOKIE_SECURE=true` theo `pccc-BE/src/server.js`.
- Integration test tự chạy backend in-memory trên 4000 và frontend production trên 3100.
  Kiểm tra cổng trước; không tự dừng tiến trình của người dùng để giải phóng cổng.
- Build dùng Inter qua `next/font/google`; lần chưa có cache có thể cần mạng.
- `format:check` chỉ kiểm danh sách trong `scripts/format-auth.mjs`, không bao phủ toàn repository.
  Với Markdown như file này, có thể kiểm trực tiếp bằng
  `node node_modules/prettier/bin/prettier.cjs --check AGENTS.md`.

## Quy ước khi sửa code

- Đọc guide tương ứng trong `pccc-FE/node_modules/next/dist/docs/` trước khi thay đổi Next.js.
  Các guide liên quan thường gặp: `01-app/01-getting-started/05-server-and-client-components.md`,
  `01-app/01-getting-started/16-proxy.md`, `01-app/02-guides/environment-variables.md`.
  Nếu docs local chưa có, khôi phục dependency đúng lockfile trước khi dựa vào API mới.
- Giữ Server Components cho đọc dữ liệu phía server; chỉ thêm `"use client"` khi cần tương tác.
  Giữ cookie/credential và logic database ở server; dùng `pccc-FE/src/proxy.ts` theo convention hiện tại.
- Dùng alias `@/*` tới `pccc-FE/src/*`, type/contract chung và component có sẵn. Theo convention từng file;
  tránh reformat diện rộng. Prettier dùng double quote, printWidth 100, trailing comma.
- Giữ giao diện và thông báo tiếng Việt có dấu, token trong `pccc-FE/src/app/globals.css`, label form,
  keyboard/focus, responsive và loading/error/empty state khi lấy dữ liệu.
- Validation Zod phía client phục vụ UX; backend vẫn validate độc lập trong `core/validation.js` và service.
- Quyền backend phải kết hợp permission và data scope (all/unit/region/facility), kèm trạng thái
  đối tượng khi nghiệp vụ áp dụng. Search, count, dashboard, export và lookup đều phải giữ scope.
- Giữ session HttpOnly, kiểm Origin cho mutation, giới hạn request và audit hiện có.
  Không thay bằng session localStorage hoặc tin role/scope từ client.
- Bảo toàn audit/history, chuyển giao cán bộ và lifecycle theo `RULES.md`; không hard-delete
  dữ liệu cần truy vết. Không tự chốt thời hạn/phê duyệt chưa xác nhận hoặc dùng dữ liệu mật cho demo.

## Chọn skill ECC theo nhiệm vụ

Kiểm tra skill có trong phiên và đọc `SKILL.md` thực tế trước khi áp dụng. Chỉ dùng skill phục vụ
task; giữ convention dự án khi ví dụ trong skill dùng stack khác. Không cài thêm skill/plugin
hoặc tạo file cấu hình harness ngoài yêu cầu. Tên dưới đây là skill ECC đang có khi khảo sát:

| Công việc                                | Skill phù hợp                                                                      |
| ---------------------------------------- | ---------------------------------------------------------------------------------- |
| Tra cứu ECC / đọc kiến trúc repo         | `ecc:ecc-guide`, `ecc:codebase-onboarding`                                         |
| Quy ước code / React và form             | `ecc:coding-standards`, `ecc:react-patterns`, `ecc:frontend-patterns`              |
| API Node / validation / lỗi              | `ecc:backend-patterns`, `ecc:api-design`, `ecc:error-handling`                     |
| Auth, session, RBAC, input/file nhạy cảm | `ecc:security-review`                                                              |
| Schema và chuyển đổi database            | `ecc:database-migrations`; thêm `ecc:postgres-patterns` khi thực sự làm PostgreSQL |
| Keyboard, label, focus, responsive UI    | `ecc:frontend-a11y`, `ecc:accessibility`                                           |
| Kiểm tra thay đổi / tự rà soát kết quả   | `ecc:verification-loop`, `ecc:agent-self-evaluation`                               |

Không áp dụng Prisma, Supabase, Express, Jest hoặc Playwright chỉ vì skill có ví dụ dùng chúng;
chỉ bổ sung công cụ khi task cần và phù hợp kiến trúc. Không tự spawn sub-agent nếu task hoặc
hướng dẫn áp dụng không yêu cầu làm việc song song bằng agent.

## Kiểm chứng và bàn giao

- Trước khi sửa, xem `git status` và diff; giữ nguyên thay đổi có sẵn không thuộc task.
- Với thay đổi code, chạy formatter, lint, typecheck, backend check, test và build theo phạm vi
  và gate trong `AGENT.md`/`CHECKLIST.md`; build trước integration test. Không thêm coverage gate
  hoặc tuyên bố có bộ kiểm thử UI nếu repository chưa cấu hình.
- Thêm test cho logic, lỗi và hồi quy quan trọng; feature có phân quyền cần case 401/403 và scope
  rỗng/ngoài phạm vi. Dùng SQLite in-memory cho test theo pattern hiện có.
- Với thay đổi chỉ tài liệu, kiểm format, đường dẫn/lệnh, tính đúng với source và `git diff --check`;
  các kiểm thử runtime không liên quan đánh dấu `N/A`, không ghi PASS nếu chưa chạy.
- Tự rà lại `RULES.md`, các mục liên quan trong `CHECKLIST.md` và diff cuối. Báo kết quả ngắn:
  thay đổi gì, file chính, kiểm chứng thực tế, self-check và giả định/blocker còn lại.
  Không lấy kết quả trong `pccc-BE/VERIFICATION.md` làm kết quả mới.
