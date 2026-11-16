# Test case và kết quả DOC/VIO

Commit: `942bbabaa658eb6d0c9bd76b0e11b4f215cd598b`. Node v22.23.4. Thời điểm UTC: 2026-11-16T07:48:52.875Z.

{"PASS":34,"FAIL":0,"BLOCKED":0}. Mỗi case dùng database PGlite mới, tài khoản demo và grants M04 cấu hình riêng. Không dùng dữ liệu thật. Đây là kiểm thử HTTP, không phải thao tác trình duyệt. Ánh xạ số riêng UC-VIO-01..05 chưa xác nhận vì thiếu đặc tả URD; chỉ khẳng định bao phủ nhóm nghiệp vụ.

| ID | UC | Nội dung | Các bước | Kỳ vọng | Kết quả | Minh chứng |
|---|---|---|---|---|---|---|
| DOC-01 | UC-DOC-01/02 | Tạo → phân loại → cập nhật → tìm kiếm → tải PDF | Chỉ huy tạo PDF; cập nhật loại decree/version 1; cán bộ tìm TEST-DOC-001, đọc lại và tải PDF. | Lưu đúng, version 2, tìm đúng ID, PDF nguyên vẹn, lịch sử có 2 sự kiện. | PASS | [JSON](evidence/DOC-01.json) |
| DOC-02 | UC-DOC-02 | Chặn thiếu tên văn bản | POST văn bản có title rỗng bằng chỉ huy. | 400, không tạo bản ghi. | PASS | [JSON](evidence/DOC-02.json) |
| DOC-03 | UC-DOC-02 | Cán bộ không có quyền tạo | Cán bộ POST văn bản hợp lệ. | 403. | PASS | [JSON](evidence/DOC-03.json) |
| DOC-04 | UC-DOC-01 | Tài liệu yêu cầu đăng nhập | GET danh sách văn bản không cookie. | 401. | PASS | [JSON](evidence/DOC-04.json) |
| VIO-01 | UC-VIO-01..05 | Ghi nhận, đình chỉ, khắc phục, phê duyệt | Cán bộ tạo vi phạm CS001, đình chỉ, thêm khắc phục/PDF, gửi duyệt; chỉ huy duyệt; đọc lại hồ sơ/cơ sở. | Hồ sơ completed, cơ sở active; PDF và lịch sử đầy đủ. | PASS | [JSON](evidence/VIO-01.json) |
| VIO-02 | UC-VIO-01..05 | Từ chối, cập nhật và gửi lại | Gửi hồ sơ; chỉ huy từ chối có lý do; cán bộ cập nhật khắc phục; gửi lại và duyệt. | Lưu lý do, lịch sử returned, giữ đình chỉ sau từ chối; hoạt động sau duyệt. | PASS | [JSON](evidence/VIO-02.json) |
| VIO-03 | UC-VIO-01..05 | Thiếu trường bắt buộc | Lần lượt bỏ facilityId/type/severity/detectedOn/description/trackedOfficerId. | Mọi request 400; không ghi hồ sơ. | PASS | [JSON](evidence/VIO-03.json) |
| VIO-04 | UC-VIO-01..05 | Ngày/hạn không hợp lệ | Tạo với ngày 2026-02-30 và hạn trước ngày phát hiện. | 400. | PASS | [JSON](evidence/VIO-04.json) |
| VIO-05 | UC-VIO-01..05 | Cơ sở không phép/không đủ điều kiện | Tạo hai hồ sơ với facilityCondition unlicensed/insufficient; đọc lại. | Mỗi hồ sơ lưu đúng phân loại. | PASS | [JSON](evidence/VIO-05.json) |
| VIO-06 | UC-VIO-01..05 | Chặn gửi duyệt thiếu bằng chứng | Thêm khắc phục nhưng không upload; gửi duyệt. | 409 MISSING_EVIDENCE; trạng thái vẫn remediation. | PASS | [JSON](evidence/VIO-06.json) |
| VIO-07 | UC-VIO-01..05 | Chặn gửi duyệt trước khắc phục | Tạo vi phạm rồi gửi duyệt ngay. | 409. | PASS | [JSON](evidence/VIO-07.json) |
| VIO-08 | UC-VIO-01..05 | Cán bộ không được phê duyệt | Cán bộ gọi trực tiếp API approve của hồ sơ chờ duyệt. | 403; hồ sơ vẫn pending_approval, cơ sở suspended. | PASS | [JSON](evidence/VIO-08.json) |
| VIO-09 | UC-VIO-01..05 | Chặn từ chối thiếu lý do | Chỉ huy reject với reason rỗng. | 400; giữ pending_approval. | PASS | [JSON](evidence/VIO-09.json) |
| VIO-10 | UC-VIO-01..05 | Chặn duyệt lặp | Duyệt thành công rồi duyệt lại. | 409 lần hai; chỉ có một lịch sử completed. | PASS | [JSON](evidence/VIO-10.json) |
| VIO-11 | UC-VIO-01..05 | Khóa hồ sơ đã hoàn thành | Sau duyệt, sửa vi phạm/thêm khắc phục/upload bằng chứng. | Cả ba request 409. | PASS | [JSON](evidence/VIO-11.json) |
| VIO-12 | UC-VIO-01..05 | Khóa quyết định đình chỉ của hồ sơ đã hoàn thành | Sau duyệt, PUT suspension thay số quyết định. | 409 và quyết định không thay đổi theo yêu cầu thao tác hồ sơ đã đóng. | PASS | [JSON](evidence/VIO-12.json) |
| VIO-13 | UC-VIO-01..05 | Chặn cơ sở ngoài phạm vi | Cán bộ KP01 tạo vi phạm cho CS003/KP03. | 404. | PASS | [JSON](evidence/VIO-13.json) |
| VIO-14 | UC-VIO-01..05 | Scope rỗng chặn đọc/ghi và file | Tạo hồ sơ và PDF, xóa scope cán bộ trong fixture, thử list/detail/file/create. | Không đọc/ghi được hồ sơ ngoài scope; list rỗng hoặc 403. | PASS | [JSON](evidence/VIO-14.json) |
| VIO-15 | UC-VIO-01..05 | Chưa đăng nhập | GET danh sách và POST vi phạm không cookie. | 401. | PASS | [JSON](evidence/VIO-15.json) |
| VIO-16 | UC-VIO-01..05 | Upload sai loại/nội dung | Upload exe rồi PDF có nội dung văn bản thường. | 400 cho cả hai. | PASS | [JSON](evidence/VIO-16.json) |
| VIO-17 | UC-VIO-01..05 | Bằng chứng gắn đúng hồ sơ | Upload vào A, tải cùng evidence ID qua hồ sơ B. | 404. | PASS | [JSON](evidence/VIO-17.json) |
| VIO-18 | UC-VIO-01..05 | Không bỏ qua duyệt qua API cơ sở | Tạo hồ sơ chờ duyệt; cán bộ PUT trạng thái cơ sở active. | 403 hoặc lỗi validation; cơ sở vẫn suspended. | PASS | [JSON](evidence/VIO-18.json) |
| VIO-19 | UC-VIO-01..05 | Nhiều quyết định đình chỉ cùng cơ sở | Tạo hai hồ sơ đình chỉ; duyệt hồ sơ A rồi B. | Sau A vẫn suspended; sau B active. | PASS | [JSON](evidence/VIO-19.json) |
| VIO-20 | UC-VIO-01..05 | Cán bộ theo dõi không tồn tại | Tạo hồ sơ với trackedOfficerId TEST-NO-SUCH-OFFICER. | 400/404, không lưu tham chiếu cán bộ không tồn tại (R-402/R-501). | PASS | [JSON](evidence/VIO-20.json) |
| VIO-21 | UC-VIO-01..05 | Lịch sử cơ sở đồng bộ khi đình chỉ | Đọc lịch sử cơ sở trước/sau POST suspension. | Lịch sử cơ sở có sự kiện active → suspended (BR-03). | PASS | [JSON](evidence/VIO-21.json) |
| VIO-22 | UC-VIO-01..05 | Tìm kiếm, lọc và phân trang | Tạo hai loại; lọc type/facility/status, search ID, pageSize 1. | Đúng ID, tổng số và số phần tử; không có hồ sơ sai bộ lọc. | PASS | [JSON](evidence/VIO-22.json) |
| VIO-23 | UC-VIO-01..05 | Đình chỉ thiếu số quyết định / trùng | POST số rỗng; POST hợp lệ; POST lại. | 400, 201, 409; không nhân đôi quyết định. | PASS | [JSON](evidence/VIO-23.json) |
| VIO-24 | UC-VIO-01..05 | Tiến độ khắc phục không hợp lệ | POST progress -1, 101, 1.5. | 400; không lưu khắc phục. | PASS | [JSON](evidence/VIO-24.json) |
| VIO-25 | UC-VIO-01..05 | Đồng bộ với hồ sơ đình chỉ từ phân hệ cơ sở | Admin đình chỉ CS001 qua API cơ sở; tạo thêm hồ sơ M04; duyệt hồ sơ M04 trong khi hồ sơ đình chỉ ban đầu còn mở. | Cơ sở vẫn suspended khi còn hồ sơ đình chỉ chưa được duyệt (BR-09). | PASS | [JSON](evidence/VIO-25.json) |
| VIO-26 | UC-VIO-01..05 | Thu hồi quyền duyệt có hiệu lực ngay | Tạo hồ sơ chờ duyệt; bỏ M04.approve của A01 trong fixture; gọi approve bằng session hiện có. | 403, không chuyển trạng thái. | PASS | [JSON](evidence/VIO-26.json) |
| VIO-27 | UC-VIO-01..05 | Cập nhật sang cán bộ không tồn tại không làm mất dữ liệu cũ | Tạo vi phạm hợp lệ; PUT mã cán bộ không tồn tại kèm mô tả mới; đọc lại hồ sơ. | 400 INVALID_OFFICER; cán bộ và mô tả ban đầu giữ nguyên. | PASS | [JSON](evidence/VIO-27.json) |
| VIO-28 | UC-VIO-01..05 | Không thể tự đặt trạng thái hoàn thành qua API sửa vi phạm | Tạo vi phạm; PUT status=completed trực tiếp; đọc lại hồ sơ. | 400; toàn bộ hồ sơ và lịch sử giữ nguyên, không bỏ qua phê duyệt. | PASS | [JSON](evidence/VIO-28.json) |
| VIO-29 | UC-VIO-01..05 | Quyết định hết hiệu lực trước ngày ban hành bị từ chối | Tạo vi phạm; lập đình chỉ có effectiveUntil trước issuedOn; đọc lại hồ sơ và cơ sở. | 400; không có quyết định, không đổi trạng thái hoặc lịch sử cơ sở. | PASS | [JSON](evidence/VIO-29.json) |
| VIO-30 | UC-VIO-01..05 | Khắc phục chỉ có khoảng trắng bị từ chối dù tiến độ 100% | Tạo vi phạm; thêm khắc phục note chỉ có khoảng trắng, progress=100; đọc lại hồ sơ. | 400; không thêm khắc phục hoặc đổi trạng thái/lịch sử. | PASS | [JSON](evidence/VIO-30.json) |
