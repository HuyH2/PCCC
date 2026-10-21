# Inspection Planning & Scheduling (UC-INS-01..05)

## Luồng được hỗ trợ

`Kế hoạch năm → phân bổ tháng/tuần/cán bộ → chọn cơ sở → hồ sơ định kỳ + lịch → thông báo → dời lịch`.

- Kế hoạch ở trạng thái `draft`, `published`, `closed`; chỉ kế hoạch đã công bố mới tạo hồ sơ định kỳ.
- Chỉ tiêu năm được tạo cùng kế hoạch. Chỉ tiêu tuần cần chỉ tiêu tháng; giao cán bộ/địa bàn cần chỉ
  tiêu kỳ cha. Tổng phân bổ không vượt chỉ tiêu cha, nhưng số cuộc kiểm tra thực tế có thể vượt chỉ
  tiêu (BR-04).
- Hồ sơ định kỳ dùng chung bảng `inspections` với module thực hiện kiểm tra. Lịch hiện tại nằm ở
  `inspection_schedules`, đồng thời đồng bộ `inspections.scheduled_date` để giữ API cũ tương thích.
- Đổi ngày chỉ qua API dời lịch, bắt buộc lý do. `inspection_reschedules` là append-only và thông báo
  đã gửi được trả về nháp để cập nhật ngày mới (BR-03, BR-08).
- Mọi truy vấn danh sách/chi tiết/file đều lọc scope trước khi trả dữ liệu; mutation kiểm tra thêm
  permission M06, actor của use case và trạng thái đối tượng.

## API chính

- `GET|POST /api/inspection-plans`; `GET|PUT /api/inspection-plans/:id`
- `POST /api/inspection-plans/:id/targets`
- `GET /api/inspection-plans/:id/facilities`
- `POST /api/inspection-plans/:id/inspections`
- `GET /api/inspection-schedules`
- `GET /api/inspections/:id/planning`
- `PUT /api/inspections/:id/lead-officer`; `PUT /api/inspections/:id/schedule`
- `POST /api/inspections/:id/notice`
- `GET|POST /api/inspections/:id/reschedules`

Các file thông báo, quyết định đoàn và văn bản dời lịch có endpoint tải riêng dưới hồ sơ kiểm tra;
chỉ PDF/JPEG/PNG đúng chữ ký file và trong giới hạn `INSPECTION_DOCUMENT_MAX_BYTES` được lưu.

Seed demo tạo một kế hoạch đã công bố, chỉ tiêu năm/tháng/tuần/cán bộ và lịch cho các hồ sơ kiểm
tra mẫu. Dữ liệu này chỉ phục vụ chạy thử, không phải chỉ tiêu hay căn cứ pháp lý chính thức.

## Kiểm thử

Chạy riêng 8 test của module tại thư mục gốc:

```powershell
pnpm test:inspection-planning
```

Bộ test bao phủ vòng đời kế hoạch, optimistic concurrency, cây chỉ tiêu, giới hạn phân bổ, scope,
vai trò nghiệp vụ, giờ 24h, thông báo, chữ ký file, dời lịch và lịch sử append-only. Chạy toàn bộ
backend bằng `pnpm test`; kiểm tra frontend bằng `pnpm lint`, `pnpm typecheck` và `pnpm build`.

## Điểm chưa chốt trong URD

- Q08: chu kỳ theo nhóm cơ sở, bộ hồ sơ bắt buộc và thẩm quyền phê duyệt chưa được hard-code.
- Q09: công thức KPI/nợ chỉ tiêu và quy tắc chuyển/giải trình chưa được tự động hóa. Schema có
  `carryover_count` để không phải đổi mô hình dữ liệu khi quy tắc được xác nhận.
