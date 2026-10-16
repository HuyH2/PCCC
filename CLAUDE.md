@AGENTS.md
@pccc-FE/AGENTS.md

# Cấu trúc repo

Monorepo pnpm, kiến trúc modular monolith (xem [PROJECT.md](PROJECT.md) §2–§3):

- `pccc-FE/` — Next.js frontend. Quy định về Next.js ở `pccc-FE/AGENTS.md`; hướng dẫn agent chung ở `AGENTS.md`.
- `pccc-BE/` — Node.js API. Code nghiệp vụ mới đặt ở `pccc-BE/src/modules/<module>/` gồm `<module>.service.js` (logic + SQL) và `<module>.routes.js` (khai báo route), rồi đăng ký routes trong `pccc-BE/src/app.js`. Hạ tầng dùng chung ở `pccc-BE/src/core/`. Module khác chỉ import từ file `*.service.js`, không import `*.routes.js`.
- Chạy lệnh từ root: `pnpm dev:be`, `pnpm dev:fe`, `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build`.

# Quy tắc khi làm feature

- Đọc [PROJECT.md](PROJECT.md) trước khi bắt đầu để nắm kiến trúc và các feature đã có.
- Mỗi feature mới phải **ghi tiếp vào PROJECT.md** (thêm mục `Fxx` vào cuối §6 Nhật ký feature theo mẫu ở §7; cập nhật §3/§5 nếu thay đổi) trong cùng branch/PR.
- Mỗi feature mới phải có **unit test** trong `pccc-BE/test/<feature>.test.js` (`node:test`, DB `:memory:`), gồm luồng chính, edge case/validate input, 401/403 và kiểm tra scope dữ liệu. Chạy `pnpm test` thật trước khi báo hoàn thành.
