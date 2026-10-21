# M07 — Lịch công tác, giao việc, KPI và giải trình

Tài liệu này mô tả hợp đồng API và quy tắc nghiệp vụ đang dùng cho M07. Các điểm chưa có trong URD
được ghi rõ là giả định của bản demo để không biến thành quy tắc cứng ngoài phạm vi.

## Phạm vi

- UC-WRK-01: lịch công tác 7 ngày và việc quá hạn.
- UC-WRK-02: giao việc cho cán bộ.
- UC-WRK-03: cập nhật tiến độ, trạng thái và hoàn thành.
- UC-WRK-04: chỉ tiêu, kết quả KPI và nợ cộng dồn.
- UC-WRK-05: yêu cầu, phản hồi và xử lý giải trình.
- Không triển khai UC-WRK-06 (nhắn tin) trong phạm vi này; bảng `task_messages` hiện có vẫn được giữ.

## Bảng dữ liệu

| Bảng | Vai trò |
| --- | --- |
| `tasks` | Công việc hiện tại, người giao/người nhận, hạn, tiến độ, trạng thái, `completed_at`. |
| `task_assignments` | Lịch sử phân công; mỗi công việc có tối đa một dòng đang mở (`ended_at IS NULL`). |
| `task_progress` | Nhật ký tiến độ append-only; mỗi lần cập nhật/hoàn thành/hủy/mở lại là một dòng. |
| `kpi_targets` | Chỉ tiêu số việc hoàn thành của một tài khoản trong kỳ `YYYY-MM`. |
| `kpi_results` | Kết quả KPI được tính lại khi đọc, lưu để tra cứu. |
| `explanations` | Yêu cầu giải trình theo công việc hoặc theo kỳ KPI; lưu phản hồi và quyết định. |

`tasks.assigned_to` vẫn là người nhận hiện tại để tương thích với API cũ. `task_assignments` là nguồn
lịch sử; migration `016-work-kpi.sql` backfill một lần từ dữ liệu đang có.

## Quyền

- `M07.view`: xem công việc mình giao/được giao, lịch, KPI cá nhân và giải trình liên quan.
- `M07.create`: tạo công việc, gửi tin nhắn trong công việc.
- `M07.edit`: cập nhật tiến độ/trạng thái, cấu hình chỉ tiêu (A01/A02/A05), yêu cầu/xử lý giải trình.
- A01, A02, A05 được xem KPI và cấu hình chỉ tiêu trong phạm vi `accountScope`; A03/A04 chỉ xem KPI
  của chính mình.
- A05 xem toàn bộ giải trình; các vai trò khác chỉ thấy yêu cầu mình tạo hoặc yêu cầu cho chính mình.
- Mọi thao tác ghi đều kiểm tra `Origin` và ghi audit.

## API công việc

| Method | Đường dẫn | Ghi chú |
| --- | --- | --- |
| GET | `/api/tasks` | `view=all|mine|assigned`, `status`, `assigneeId`, `from`, `to`, `deadline=overdue|week`, `sort=due`, `page`, `pageSize`. |
| GET | `/api/tasks/mine` | Công việc của tôi; nhận cùng bộ lọc. |
| GET | `/api/tasks/assigned` | Công việc đã giao; nhận cùng bộ lọc. |
| GET | `/api/tasks/:id` | Chi tiết; chỉ người giao/người nhận. |
| POST | `/api/tasks` | Tạo và giao việc; ghi `task_assignments`. |
| PUT | `/api/tasks/:id/progress` | Người nhận cập nhật 0–100 kèm ghi chú; ghi `task_progress`. |
| GET | `/api/tasks/:id/progress-history` | Lịch sử tiến độ, có `before`/`after`. |
| PUT | `/api/tasks/:id/status` | `completed` (người nhận/người giao), `cancelled`/`open` (người giao). |

Hoàn thành đặt `progress=100`, `completed_at=now` và ghi một dòng `task_progress`; cập nhật 100%
không tự hoàn thành. Công việc đã hủy không nhận tiến độ/tin nhắn mới.

`deadline=overdue` tính theo ngày nghiệp vụ Việt Nam: việc đến hạn hôm nay chưa bị coi là quá hạn
cho đến hết ngày. `from`/`to` là ngày `YYYY-MM-DD`, bao gồm cả ngày `to`.

## API KPI

| Method | Đường dẫn | Ghi chú |
| --- | --- | --- |
| GET | `/api/kpi/results?period=YYYY-MM&accountId=` | Tính kết quả; mặc định kỳ hiện tại. |
| GET | `/api/kpi/debt?period=YYYY-MM&accountId=` | Chỉ trả nợ/chỉ tiêu đã đạt. |
| GET | `/api/kpi/targets?period=YYYY-MM&accountId=` | Danh sách chỉ tiêu. |
| POST | `/api/kpi/targets` | `accountId`, `period`, `targetTasks` (0–10000), `note`; upsert. |

Công thức đã chốt cho bản demo:

```text
available = target_tasks + previous_debt
completed = số task status='completed' có completed_at trong kỳ
debt      = max(0, available - completed)
score     = min(100, round(completed / available * 100))
```

- Nợ được tính tuần tự từ kỳ có chỉ tiêu sớm nhất đến kỳ đang xem; phần thiếu cộng sang kỳ sau.
- Không cộng “credit” khi vượt chỉ tiêu; điểm tối đa 100.
- Nếu kỳ chưa có chỉ tiêu, API trả `configured=false`, điểm 0 và nợ kỳ trước (nếu có).
- Kỳ mặc định lấy theo `businessPeriod()` (`Asia/Ho_Chi_Minh`), không dùng tháng UTC.

## API giải trình

| Method | Đường dẫn | Ghi chú |
| --- | --- | --- |
| GET | `/api/explanations?status=&period=` | Danh sách theo phạm vi người xem. |
| GET | `/api/explanations/:id` | Chi tiết. |
| POST | `/api/explanations` | `accountId`, `reason`, và `taskId` hoặc `period`; A01/A02/A05. |
| PUT | `/api/explanations/:id/response` | Người được yêu cầu gửi `response`. |
| PUT | `/api/explanations/:id/review` | Người yêu cầu/A05 gửi `decision=accepted|rejected`, `note`. |

Luồng trạng thái: `requested → submitted → accepted|rejected`. Chỉ giải trình `submitted` mới được
xử lý. Chấp nhận một giải trình gắn với kỳ KPI đặt `debt_waived=1`; lần tính KPI sau đó coi nợ của kỳ
đó bằng 0 và không cộng sang kỳ sau. Từ chối không thay đổi nợ.

Giả định của bản demo: giải trình theo công việc không tự xóa nợ KPI; chỉ giải trình có `period` và
được chấp nhận mới xóa nợ kỳ đó. Chỉ tiêu hiện đếm công việc hoàn thành, chưa gồm kết quả kiểm tra M06.

## Lỗi thường gặp

- `400 INVALID_INPUT`: ngày/kỳ/trạng thái/giới hạn không hợp lệ.
- `403 FORBIDDEN`: thiếu `M07.*` hoặc tài khoản ngoài phạm vi.
- `404 NOT_FOUND`: công việc/giải trình không tồn tại hoặc không thuộc người xem.
- `409 TASK_CLOSED`, `TASK_CHANGED`, `NO_CHANGE`, `EXPLANATION_CLOSED`, `EXPLANATION_CHANGED`:
  trạng thái đã đổi hoặc thao tác không còn hợp lệ; tải lại trước khi thử tiếp.
