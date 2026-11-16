# Cập nhật sau sửa lỗi — 15/11/2026

Các lỗi backend trong bảng baseline bên dưới đã sửa và retest đạt. Xem [báo cáo retest](Retest_Report.md). Các giới hạn URD và UI vẫn còn; bảng cũ giữ để truy vết phạm vi lần đầu.

# Đối chiếu phạm vi yêu cầu

Nguồn: nhiệm vụ người dùng cung cấp, AGENT.md, RULES.md, CHECKLIST.md, tài liệu LEGAL_DOCUMENTS.md và mã nguồn/schema hiện tại. **Chưa có đặc tả URD đầy đủ cho từng mã UC-VIO.** Vì vậy không tự gán UC-VIO-01 = một nghiệp vụ cụ thể; bảng test dùng nhãn nhóm UC-VIO-01..05.

| Yêu cầu                         | Kiểm thử                                                            | Kết quả / giới hạn                                                                                                                                        |
| ------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UC-DOC-01: tra cứu, xem văn bản | DOC-01, DOC-04, UI-04; bộ legal-documents hiện có                   | HTTP tìm kiếm/đọc/PDF đạt; UI tìm kiếm và mở chi tiết đạt                                                                                                 |
| UC-DOC-02: cập nhật/phân loại   | DOC-01..03, UI-02/03; bộ legal-documents hiện có                    | Đạt các trường hợp đã thực thi                                                                                                                            |
| UC-VIO-01..05: ghi nhận vi phạm | VIO-01,03,04,20,22; UI-05                                           | Có lỗi cán bộ không tồn tại                                                                                                                               |
| Hồ sơ đình chỉ                  | VIO-01,12,19,21,23,25                                               | Có lỗi hồ sơ đã đóng, lịch sử và đồng bộ hai phân hệ                                                                                                      |
| Không phép/không đủ điều kiện   | VIO-05                                                              | Lưu và đọc lại đúng phân loại; chưa xác nhận quy tắc pháp lý bổ sung                                                                                      |
| Hồ sơ khắc phục                 | VIO-01,02,06,07,16,17,24                                            | Các trường hợp HTTP đã chạy đạt                                                                                                                           |
| Phê duyệt hoạt động lại         | VIO-01,08,10,18,19,25,26                                            | Luồng cơ bản đạt; trường hợp đình chỉ từ hai phân hệ FAIL                                                                                                 |
| Từ chối, lý do và gửi lại       | VIO-02,09                                                           | HTTP đạt, UI còn chưa chạy đầy đủ                                                                                                                         |
| Phân quyền, scope và trạng thái | VIO-08..15,18,26                                                    | Có lỗi sửa quyết định sau completed; các case còn lại đạt                                                                                                 |
| Liên kết cơ sở/hồ sơ kiểm tra   | VIO-01 giữ đúng facilityId; fixture có seed kiểm tra của repository | Chưa xác minh liên kết cụ thể violation → inspection; API/schema violations hiện không có inspectionId. Cần đặc tả để xác nhận yêu cầu liên kết trực tiếp |
| Bằng chứng và lịch sử           | DOC-01, VIO-01,02,06,16,17,21                                       | File HTTP và history vi phạm đạt; history cơ sở có lỗi                                                                                                    |

## Những điều chưa được tự xác nhận

- Q02: grants trong fixture chỉ để kiểm cơ chế cho phép/chặn, không phải ma trận quyền chính thức.
- Chính sách số lượng/loại bằng chứng, tiến độ tối thiểu để duyệt và phạm vi cán bộ theo dõi chưa có đặc tả đầy đủ. Không biến suy luận thành bug pháp lý.
- Chưa thực hiện kiểm tải, bảo mật toàn diện, kiểm đồng thời nhiều người duyệt, PostgreSQL server thật, staging hoặc toàn bộ regression repository.
- Các test mới là kiểm thử tích hợp HTTP trên backend thật và database nhúng; không thay thế 4 luồng E2E trình duyệt.
