@AGENTS.md

# Quy tắc khi làm feature

- Đọc [PROJECT.md](PROJECT.md) trước khi bắt đầu để nắm kiến trúc và các feature đã có.
- Mỗi feature mới phải **ghi tiếp vào PROJECT.md** (thêm mục `Fxx` vào cuối §6 Nhật ký feature theo mẫu ở §7; cập nhật §3/§5 nếu thay đổi) trong cùng branch/PR.
- Mỗi feature mới phải có **unit test** trong `Backend/test/<feature>.test.js` (`node:test`, DB `:memory:`), gồm luồng chính, edge case/validate input, 401/403 và kiểm tra scope dữ liệu. Chạy `npm test` thật trước khi báo hoàn thành.
