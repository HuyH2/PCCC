# M06 — Thực hiện kiểm tra và quản lý kết quả (SCRUM-22)

Use case: UC-INS-06 (checklist/hướng dẫn), UC-INS-07 (biên bản, tài liệu), UC-INS-08 (kết quả,
kết luận, hậu kiểm), UC-INS-09 (kiểm tra đột xuất/chuyên đề). Module `src/modules/inspections/`,
migration `migrations/005-inspections.sql`, test `test/inspections.test.js`.

## Luồng và trạng thái

`Cuộc kiểm tra → Checklist → Biên bản → Kết quả → Kết luận → Hoàn thành → Hậu kiểm`

| Trạng thái                     | Vào khi                                                | Cho phép                                                                |
| ------------------------------ | ------------------------------------------------------ | ----------------------------------------------------------------------- |
| `planned` (Lên kế hoạch)       | Tạo cuộc kiểm tra                                      | Chọn checklist + lưu kết quả (chuyển sang `in_progress`)                |
| `in_progress` (Đang thực hiện) | Lưu nháp kết quả checklist lần đầu                     | Lưu nháp kết quả/ghi chú, chốt kết quả, tải biên bản/tài liệu, kết luận |
| `evaluated` (Đã đánh giá)      | Chốt kết quả (`submit: true`) khi đủ nội dung bắt buộc | Checklist bị khóa; vẫn tải biên bản/tài liệu, sửa kết luận, hoàn thành  |
| `completed` (Hoàn thành)       | Hoàn thành (đủ điều kiện bên dưới)                     | Tạo/cập nhật hậu kiểm; chỉ bổ sung bằng chứng khi hậu kiểm mở           |

`evaluated` là trạng thái suy ra: cột `status` vẫn là `in_progress` và `results_submitted_at` khác
NULL (migration 007 — SQLite không đổi được `CHECK` tại chỗ, dựng lại bảng thì vỡ khóa ngoại của
bảng con trong transaction migration). API, bộ lọc `?status=evaluated` và giao diện dùng cùng biểu
thức `STATUS_SQL` trong `inspections.service.js`.

Hoàn thành yêu cầu (BR-02): đã **chốt kết quả checklist** (mọi nội dung **bắt buộc** khác `pending`), đã có
kết quả (`pass`/`conditional`/`fail`) + kết luận, và có ít nhất một tài liệu loại `record` (biên
bản). Mỗi cuộc kiểm tra chỉ có một yêu cầu hậu kiểm đang mở (unique index). Không có API xóa tài
liệu/kết quả; mọi mutation ghi `audit_logs` (`feature='M06'`, `object_type='inspection'`).

## Bảng

`inspections` là bản ghi cuộc kiểm tra dùng chung (`inspection_id` chung với lập kế hoạch/thông
báo/dời lịch của người 3 — mở rộng bằng migration mới, không tạo bảng kiểm tra thứ hai).
`inspection_checklists` + `inspection_checklist_items` (cấu hình được, lọc theo `facility_type`;
`NULL` = áp dụng mọi loại cơ sở), `inspection_results` (một dòng/nội dung/cuộc kiểm tra),
`inspection_documents` (BLOB như kho văn bản M05 vì chưa có hệ thống attachment dùng chung),
`follow_up_inspections`.

## API

Mọi API cần session; đọc cần `M06.view`, tạo cần `M06.create`, thực hiện cần `M06.edit`. Cuộc
kiểm tra chỉ thấy/sửa được khi cơ sở thuộc scope (`facilityScope`), ngoài scope trả 404.
Mutation cần `version` (trừ upload/hậu kiểm) — lệch trả 409 `VERSION_CONFLICT`.

| Method | Path                                         | Ghi chú                                                                                                                                                                                                                                                                      |
| ------ | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/api/inspection-checklists?facilityType=`   | Checklist đang dùng; có `facilityType` thì trả checklist chung + đúng loại                                                                                                                                                                                                   |
| GET    | `/api/inspection-checklists/:id`             | Checklist + nội dung, hướng dẫn, căn cứ                                                                                                                                                                                                                                      |
| POST   | `/api/inspection-checklists`                 | `M06.create` **và** vai trò A01 (Chỉ huy) hoặc A02 (Phó chỉ huy); `{name,facility_type?,description?,legal_document_id?,items:[{content,guidance?,legal_reference?,is_required?}]}` (1–100 nội dung, thứ tự theo mảng); trùng tên + loại cơ sở trả 409 `DUPLICATE_CHECKLIST` |
| GET    | `/api/inspections?q=&status=&kind=&page=`    | Danh sách theo scope, phân trang                                                                                                                                                                                                                                             |
| POST   | `/api/inspections`                           | `M06.create`; `{facility_id,kind:'unscheduled'\|'thematic',topic?,reason,scheduled_date,lead_officer_id?,checklist_id?}`                                                                                                                                                     |
| GET    | `/api/inspections/:id`                       | `{inspection,items,documents,followUps}`                                                                                                                                                                                                                                     |
| PUT    | `/api/inspections/:id/results`               | `{version,checklist_id?,officer_note?,items:[{item_id,status,note}],submit?}`; status `pending/pass/fail/not_applicable`. `submit:true` = chốt kết quả (409 `INCOMPLETE_CHECKLIST` nếu còn nội dung bắt buộc chưa đánh giá); đã chốt thì mọi lần lưu trả 409                 |
| POST   | `/api/inspections/:id/documents`             | Body là file thô PDF/JPEG/PNG (kiểm magic bytes, tối đa `INSPECTION_DOCUMENT_MAX_BYTES`); header `X-Document-Kind: record\|evidence`, `X-File-Name`, `X-Record-Number` (bắt buộc với biên bản), `X-Document-Description` (URI-encoded)                                       |
| GET    | `/api/inspections/:id/documents/:docId/file` | Tải file, kiểm quyền + scope như chi tiết                                                                                                                                                                                                                                    |
| PUT    | `/api/inspections/:id/conclusion`            | `{version,outcome:'pass'\|'conditional'\|'fail',conclusion}`; chỉ khi `in_progress`                                                                                                                                                                                          |
| POST   | `/api/inspections/:id/complete`              | `{version}`; lỗi 409 `INCOMPLETE_CHECKLIST` / `RESULTS_NOT_SUBMITTED` / `MISSING_CONCLUSION` / `MISSING_RECORD`                                                                                                                                                              |
| POST   | `/api/inspections/:id/follow-ups`            | `{requirement,due_date}`; chỉ khi `completed`; 409 `DUPLICATE_FOLLOW_UP`                                                                                                                                                                                                     |
| PUT    | `/api/inspections/:id/follow-ups/:fid`       | `{outcome:'resolved'\|'unresolved',result_note}`; chỉ yêu cầu đang mở                                                                                                                                                                                                        |

## Giả định cần xác nhận

- Bảng `inspections` tạo tối thiểu tại đây vì repo chưa có phần của người 3; kiểm tra định kỳ
  (`periodic`) do luồng kế hoạch tạo, API tạo ở đây chỉ nhận đột xuất/chuyên đề.
- Nội dung checklist seed là mẫu (Q04). Chỉ huy/Phó chỉ huy tạo checklist mới (migration 006 thêm
  `created_by` và chặn trùng tên); chưa có sửa/ngưng sử dụng checklist.
- Loại cơ sở chưa có trong bảng `facilities`, nên checklist lọc theo tham số `facilityType`.
- Quyền M06 trong seed là ma trận mẫu (Q02). Seed không ghi đè quyền vai trò đã có; DB cũ cần cấp
  M06 qua `/quan-tri/vai-tro` hoặc tạo lại DB demo.
- Chưa bắt buộc tài liệu khi đóng hậu kiểm, chưa giới hạn sửa theo trưởng đoàn — chỉ theo quyền + scope.
