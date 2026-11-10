# KỊCH BẢN KIỂM THỬ CHẤP NHẬN NGƯỜI DÙNG (UAT SCRIPTS)
## HỆ THỐNG QUẢN LÝ CÔNG TÁC PCCC & CNCH — PC07 / ĐỘI KHU VỰC 10

---

## 1. THÔNG TIN CHUNG

- **Mã tài liệu:** `UAT-PCCC-ALL-ROLES`
- **Phiên bản:** `2.0`
- **Ngày ban hành:** `09/11/2026`
- **Tác giả:** QA Lead / Lead Business Analyst
- **Mục tiêu:** Hướng dẫn chi tiết từng bước thao tác trên giao diện thực tế cho từng vai trò người dùng (A01 đến A06), cung cấp dữ liệu mẫu, tiêu chí chấp nhận và biên bản ký xác nhận nghiệm thu người dùng (UAT Sign-off).
- **Môi trường UAT:**
  - Frontend: `http://localhost:3000` (Next.js 16 App Router)
  - Backend API: `http://localhost:4000` (Node.js API Server)
  - Tài khoản demo mặc định: mật khẩu thiết lập từ biến môi trường `DEMO_PASSWORD` (`README.md`).

---

## 2. DANH MỤC VAI TRÒ & TÀI KHOẢN TRẢI NGHIỆM

| Mã vai trò | Tên vai trò | Tài khoản demo | Phạm vi mặc định (Scope) | Trách nhiệm chính |
|:---:|---|---|---|---|
| **A01** | Chỉ huy / Đội trưởng | `demo.chi-huy` | Toàn đơn vị (`unit`) | Quản lý toàn diện, giao việc, duyệt kiểm tra, KPI & duyệt giải trình |
| **A02** | Phó chỉ huy / Tổ trưởng | `demo.to-truong` | Khu vực Tổ 1 (`unit/region`) | Điều hành tổ công tác, giao việc, phân công kiểm tra, đôn đốc tiến độ |
| **A03** | Cán bộ kiểm tra / QL địa bàn | `demo.can-bo` | Khu phố 01, 02 (`region`) | Nhận việc, cập nhật tiến độ, kiểm tra thực địa, phản hồi giải trình |
| **A04** | Cán bộ tổng hợp | `demo.tong-hop` | Toàn đơn vị (`unit`) | Tổng hợp số liệu, báo cáo định kỳ, thực hiện nhiệm vụ văn phòng |
| **A05** | Quản trị hệ thống | `demo.admin` | Toàn hệ thống (`all`) | Quản trị tài khoản, phân quyền, văn bản pháp luật, nhật ký hệ thống |
| **A06** | Lãnh đạo cấp phòng / Người xem | `demo.nguoi-xem` | Toàn đơn vị (`unit`) | Xem báo cáo, theo dõi tiến độ, tra cứu số liệu (chỉ đọc) |

---

## 3. KỊCH BẢN UAT THEO VAI TRÒ

### 3.1 KỊCH BẢN CHO VAI TRÒ A01 — CHỈ HUY / ĐỘI TRƯỞNG

#### Kịch bản UAT-A01-01: Giao việc mới, theo dõi tiến độ và nghiệm thu hoàn thành (M07)
- **Tài khoản:** `demo.chi-huy`
- **Mục tiêu:** Kiểm tra luồng giao nhiệm vụ kiểm tra an toàn PCCC cho cán bộ cấp dưới và nghiệm thu kết quả.

| Bước | Thao tác trên giao diện | Dữ liệu mẫu | Kết quả mong đợi | Đạt / Không đạt |
|:---:|---|---|---|:---:|
| 1 | Đăng nhập hệ thống với vai trò Chỉ huy | Username: `demo.chi-huy`<br>Password: `[DEMO_PASSWORD]` | Đăng nhập thành công, chuyển hướng vào Dashboard `/` | [  ] |
| 2 | Điều hướng vào menu **Lịch & Công việc** → **Giao việc & Tiến độ** (`/cong-viec/giao-viec`) | — | Màn hình hiển thị danh sách công việc và nút "Giao việc mới" | [  ] |
| 3 | Mở form giao việc và nhập thông tin | - Tiêu đề: `Kiểm tra an toàn PCCC chung cư Sunrise`<br>- Mô tả: `Kiểm tra hệ thống báo cháy tự động và họng nước chữa cháy`<br>- Loại việc: `Công việc được giao`<br>- Hạn: Chọn ngày hôm nay<br>- Cán bộ: Chọn `demo.can-bo` | Form điền đầy đủ dữ liệu; dropdown hiển thị danh sách cán bộ trong đơn vị | [  ] |
| 4 | Nhấn nút **Giao việc** | — | Thông báo giao việc thành công, công việc mới xuất hiện trên đầu bảng với trạng thái `Đang thực hiện`, tiến độ `0%` | [  ] |
| 5 | Nhấn vào tiêu đề công việc để mở trang chi tiết (`/cong-viec/giao-viec/[id]`) | — | Hiển thị đầy đủ thông tin: Mã việc, Người giao (Chỉ huy), Người nhận (Cán bộ), Hạn hoàn thành | [  ] |
| 6 | Kiểm tra sau khi cán bộ cập nhật tiến độ (F5 hoặc chờ 5s) | — | Thấy tiến độ cập nhật (vd: 30%, 70%, 100%) kèm ghi chú tại mục Lịch sử tiến độ | [  ] |
| 7 | Nhấn nút **Hoàn thành** tại mục Trạng thái | Ghi chú: `Đã nghiệm thu biên bản đạt yêu cầu` | Công việc chuyển sang trạng thái `Hoàn thành`, tiến độ chốt `100%`, ghi nhận thời gian hoàn thành | [  ] |

---

#### Kịch bản UAT-A01-02: Quản lý KPI đội, gửi yêu cầu giải trình và phê duyệt xóa nợ chỉ tiêu (M07)
- **Tài khoản:** `demo.chi-huy`
- **Mục tiêu:** Kiểm tra giao diện KPI toàn đội, yêu cầu giải trình khi có nợ và duyệt giải trình để xóa nợ.

| Bước | Thao tác trên giao diện | Dữ liệu mẫu | Kết quả mong đợi | Đạt / Không đạt |
|:---:|---|---|---|:---:|
| 1 | Mở menu **Lịch & Công việc** → **KPI & Nợ chỉ tiêu** (`/cong-viec/kpi`) | Chọn kỳ tháng hiện tại (`YYYY-MM`) | Hiển thị tổng quan KPI đội: Số chỉ tiêu, Tỷ lệ hoàn thành, Tổng nợ và danh sách cán bộ trong đội | [  ] |
| 2 | Thiết lập chỉ tiêu công việc cho cán bộ A03 | Cán bộ: `demo.can-bo`<br>Chỉ tiêu: `5 việc`<br>Ghi chú: `Chỉ tiêu tháng` | Nhấn Lưu chỉ tiêu → Bảng cập nhật ngay lập tức chỉ tiêu 5 việc cho cán bộ A03 | [  ] |
| 3 | Mở menu **Giải trình công việc & KPI** (`/cong-viec/giai-trinh`) | — | Màn hình hiển thị 4 thẻ thống kê: Chờ phản hồi, Chờ xử lý, Đã chấp nhận, Không chấp nhận | [  ] |
| 4 | Nhấn "Yêu cầu giải trình mới" | - Cán bộ: Chọn `demo.can-bo`<br>- Loại: Chọn `Kỳ KPI`<br>- Kỳ: Chọn kỳ hiện tại<br>- Lý do: `Chưa đạt số lượng nhiệm vụ được giao` | Gửi yêu cầu thành công; thẻ "Chờ cán bộ phản hồi" tăng thêm 1 | [  ] |
| 5 | Chờ cán bộ gửi phản hồi giải trình (chuyển sang thẻ "Chờ chỉ huy xử lý") | — | Danh sách xuất hiện nút "Xử lý giải trình" | [  ] |
| 6 | Nhấn "Xử lý giải trình", chọn **Chấp nhận** | - Quyết định: `Chấp nhận`<br>- Ghi chú: `Lý do chính đáng, đồng ý miễn trừ nợ` | Giải trình chuyển sang trạng thái `Đã chấp nhận`, huy hiệu xanh | [  ] |
| 7 | Quay lại trang **KPI & Nợ chỉ tiêu** kiểm tra lại | Kỳ tháng hiện tại | Cột nợ của cán bộ A03 được xóa về `0`, số nợ được chuyển sang cột `Được miễn` | [  ] |

---

### 3.2 KỊCH BẢN CHO VAI TRÒ A02 — TỔ TRƯỞNG / PHÓ CHỈ HUY

#### Kịch bản UAT-A02-01: Xem lịch công tác 7 ngày và giám sát việc quá hạn (M07)
- **Tài khoản:** `demo.to-truong`
- **Mục tiêu:** Theo dõi kế hoạch làm việc tuần và cảnh báo việc trễ hạn.

| Bước | Thao tác trên giao diện | Dữ liệu mẫu | Kết quả mong đợi | Đạt / Không đạt |
|:---:|---|---|---|:---:|
| 1 | Đăng nhập tài khoản Tổ trưởng | Username: `demo.to-truong`<br>Password: `[DEMO_PASSWORD]` | Đăng nhập thành công, điều hướng vào hệ thống | [  ] |
| 2 | Vào trang **Lịch công tác hàng ngày** (`/cong-viec/lich`) | — | Hiển thị bảng phân lịch 7 ngày liên tiếp tính từ ngày hiện tại (Hôm nay + 6 ngày kế tiếp) | [  ] |
| 3 | Kiểm tra các thẻ ngày | — | Ngày hôm nay được highlight viền rõ; các công việc rơi vào ngày nào hiển thị đúng thẻ ngày đó | [  ] |
| 4 | Kiểm tra vùng cảnh báo **Công việc quá hạn** | — | Nếu có công việc quá hạn (hạn trước ngày hôm nay và chưa hoàn thành), hiển thị thẻ đỏ cảnh báo | [  ] |
| 5 | Nhấn vào 1 công việc trên lịch | — | Chuyển hướng tới trang chi tiết công việc tương ứng | [  ] |

---

### 3.3 KỊCH BẢN CHO VAI TRÒ A03 — CÁN BỘ KIỂM TRA / QUẢN LÝ ĐỊA BÀN

#### Kịch bản UAT-A03-01: Tiếp nhận công việc, cập nhật tiến độ và trao đổi tin nhắn (M07)
- **Tài khoản:** `demo.can-bo`
- **Mục tiêu:** Thực hiện công tác hàng ngày, báo cáo tiến độ và nhắn tin trao đổi với người giao việc.

| Bước | Thao tác trên giao diện | Dữ liệu mẫu | Kết quả mong đợi | Đạt / Không đạt |
|:---:|---|---|---|:---:|
| 1 | Đăng nhập tài khoản Cán bộ | Username: `demo.can-bo`<br>Password: `[DEMO_PASSWORD]` | Đăng nhập thành công | [  ] |
| 2 | Vào **Giao việc & Tiến độ** (`/cong-viec/giao-viec`), chọn tab **Việc của tôi** | — | Chỉ hiển thị các công việc được giao cho cá nhân cán bộ | [  ] |
| 3 | Mở công việc vừa được Chỉ huy giao | — | Xem chi tiết nội dung chỉ đạo | [  ] |
| 4 | Tại khối **Cập nhật tiến độ**: Kéo thanh tiến độ lên 30% và nhập ghi chú | - Tiến độ: `30%`<br>- Ghi chú: `Đã kiểm tra hồ sơ thiết kế` | Nhấn Cập nhật → Tiến độ chuyển 30%, lịch sử tiến độ ghi nhận dòng mới | [  ] |
| 5 | Thử kéo tiến độ lên 100% | - Tiến độ: `100%`<br>- Ghi chú: `Đã kiểm tra xong hiện trường` | Cập nhật thành công; trạng thái vẫn là `Đang thực hiện` (không tự hoàn thành) | [  ] |
| 6 | Tại khối **Trao đổi theo công việc**: Nhập tin nhắn | Nội dung: `Báo cáo Chỉ huy, cơ sở đã bổ sung đủ bình chữa cháy` | Nhấn Gửi → Tin nhắn xuất hiện tức thì trong khung chat kèm tên và thời gian | [  ] |
| 7 | Nhấn nút **Sửa** tại tin nhắn của mình | Nội dung mới: `Báo cáo Chỉ huy, cơ sở đã bổ sung đủ 10 bình chữa cháy` | Tin nhắn cập nhật nội dung, hiển thị nhãn "(đã chỉnh sửa)" | [  ] |
| 8 | Nhấn nút **Hoàn thành công việc** | Ghi chú: `Hoàn tất toàn bộ nội dung` | Công việc chuyển sang trạng thái `Hoàn thành`, khóa chức năng cập nhật tiến độ | [  ] |

---

#### Kịch bản UAT-A03-02: Phản hồi yêu cầu giải trình từ Chỉ huy (M07)
- **Tài khoản:** `demo.can-bo`
- **Mục tiêu:** Nhận thông báo yêu cầu giải trình và gửi văn bản giải trình lý do.

| Bước | Thao tác trên giao diện | Dữ liệu mẫu | Kết quả mong đợi | Đạt / Không đạt |
|:---:|---|---|---|:---:|
| 1 | Vào menu **Giải trình công việc & KPI** (`/cong-viec/giai-trinh`) | — | Danh sách chỉ hiển thị các giải trình liên quan đến cá nhân cán bộ | [  ] |
| 2 | Tìm yêu cầu giải trình ở trạng thái `Chờ cán bộ phản hồi` | — | Thấy lý do yêu cầu từ Chỉ huy | [  ] |
| 3 | Nhấn "Gửi phản hồi giải trình" | Nội dung: `Do tuần qua phải tham gia chữa cháy vụ cháy xưởng gỗ tại đường số 7 nên chưa kịp kiểm tra cơ sở theo kế hoạch` | Nhấn Gửi giải trình → Yêu cầu chuyển sang trạng thái `Chờ chỉ huy xử lý`, huy hiệu màu xanh dương | [  ] |

---

### 3.4 KỊCH BẢN CHO VAI TRÒ A04 — CÁN BỘ TỔNG HỢP

#### Kịch bản UAT-A04-01: Xem báo cáo định kỳ và tra cứu tiến độ công việc chung (M08, M07)
- **Tài khoản:** `demo.tong-hop`
- **Mục tiêu:** Cán bộ văn phòng theo dõi số liệu tổng hợp.

| Bước | Thao tác trên giao diện | Dữ liệu mẫu | Kết quả mong đợi | Đạt / Không đạt |
|:---:|---|---|---|:---:|
| 1 | Đăng nhập tài khoản Cán bộ tổng hợp | Username: `demo.tong-hop`<br>Password: `[DEMO_PASSWORD]` | Đăng nhập thành công | [  ] |
| 2 | Vào trang **Báo cáo định kỳ** (`/bao-cao`) | — | Hiển thị các mẫu báo cáo tháng/quý và danh mục số liệu tổng hợp | [  ] |
| 3 | Vào trang **Tra cứu toàn hệ thống** (`/tra-cuu`) | Từ khóa: `PCCC` | Kết quả tìm kiếm phân nhóm theo Cơ sở, Văn bản, Công việc; hỗ trợ tiếng Việt không dấu | [  ] |

---

### 3.5 KỊCH BẢN CHO VAI TRÒ A05 — QUẢN TRỊ HỆ THỐNG

#### Kịch bản UAT-A05-01: Quản trị tài khoản, phân quyền và tra cứu nhật ký hệ thống (M01, M10)
- **Tài khoản:** `demo.admin`
- **Mục tiêu:** Quản lý an toàn hệ thống, cấu hình vai trò phạm vi và kiểm toán audit log.

| Bước | Thao tác trên giao diện | Dữ liệu mẫu | Kết quả mong đợi | Đạt / Không đạt |
|:---:|---|---|---|:---:|
| 1 | Đăng nhập với tài khoản Quản trị | Username: `demo.admin`<br>Password: `[DEMO_PASSWORD]` | Đăng nhập thành công; menu hiển thị khối **Quản trị hệ thống** | [  ] |
| 2 | Vào **Quản trị** → **Tài khoản** (`/quan-tri/tai-khoan`) | — | Danh sách toàn bộ tài khoản trong hệ thống kèm trạng thái (Hoạt động / Khóa) | [  ] |
| 3 | Nhấn **Khóa tài khoản** một cán bộ thử nghiệm | Chọn tài khoản thử nghiệm | Trạng thái tài khoản chuyển sang `Đã khóa`; tài khoản này không thể đăng nhập được nữa | [  ] |
| 4 | Nhấn **Mở khóa** | — | Tài khoản kích hoạt lại bình thường | [  ] |
| 5 | Vào **Quản trị** → **Nhật ký thao tác** (`/quan-tri/nhat-ky`) | Lọc: `Feature = M07` | Hiển thị 100% nhật ký các thao tác tạo task, sửa tiến độ, gửi tin nhắn, duyệt giải trình vừa thực hiện ở trên kèm IP và thời gian | [  ] |

---

### 3.6 KỊCH BẢN CHO VAI TRÒ A06 — LÃNH ĐẠO CẤP PHÒNG / NGƯỜI XEM

#### Kịch bản UAT-A06-01: Kiểm tra tính năng chỉ đọc (Read-only) và bảo vệ an toàn (M10, M07)
- **Tài khoản:** `demo.nguoi-xem`
- **Mục tiêu:** Đảm bảo vai trò giám sát chỉ được xem số liệu, không có quyền chỉnh sửa.

| Bước | Thao tác trên giao diện | Dữ liệu mẫu | Kết quả mong đợi | Đạt / Không đạt |
|:---:|---|---|---|:---:|
| 1 | Đăng nhập tài khoản Người xem | Username: `demo.nguoi-xem`<br>Password: `[DEMO_PASSWORD]` | Đăng nhập thành công vào Dashboard | [  ] |
| 2 | Vào trang **Giao việc & Tiến độ** (`/cong-viec/giao-viec`) | — | Màn hình xem danh sách bình thường, KHÔNG có nút "Giao việc mới" | [  ] |
| 3 | Cố tình truy cập URL chi tiết một công việc của người khác (VD: `/cong-viec/giao-viec/[id-khong-tham-gia]`) | URL công việc của cán bộ khác | Hệ thống chặn bảo mật dữ liệu riêng tư: Trả về lỗi 404 NOT_FOUND ("Không tìm thấy công việc trong phạm vi tham gia"), không cho phép người không tham gia xem nội dung và hội thoại | [  ] |
| 4 | Cố tình truy cập trang quản trị `/quan-tri/tai-khoan` | — | Hệ thống chặn chuyển hướng về `/khong-co-quyen` hoặc Dashboard an toàn | [  ] |

---

## 4. TIÊU CHÍ CHẤP NHẬN NGHIỆM THU (UAT ACCEPTANCE CRITERIA)

1. **Giao diện & Trải nghiệm:**
   - 100% nhãn và thông báo bằng tiếng Việt có dấu, thuật ngữ PCCC & CNCH chuẩn xác.
   - Thao tác chuyển trang mượt mà, có skeleton loading khi tải dữ liệu, không có màn hình trắng (blank screen).
   - Tương thích tốt trên màn hình máy tính để bàn (1920x1080) và thiết bị di động (390px PWA).
2. **Quy tắc nghiệp vụ cốt lõi:**
   - Tiến độ 100% không tự ý đóng công việc.
   - Chỉ người giao việc mới được quyền Hủy việc hoặc Mở lại việc đã hủy.
   - Giải trình kỳ được chấp nhận phải tự động xóa nợ KPI tương ứng.
   - Tin nhắn trao đổi chỉ người trong công việc mới được đọc; xóa mềm tin nhắn không làm mất vết audit.
3. **An ninh & Bảo mật:**
   - Phân quyền đúng vai trò A01–A06; chặn đứng truy cập trái phép.
   - Mọi thao tác ghi đều lưu vết nhật ký hệ thống đầy đủ.

---

## 5. BIÊN BẢN KÝ XÁC NHẬN NGHIỆM THU NGƯỜI DÙNG (UAT SIGN-OFF)

| ĐẠI DIỆN ĐỘI KIỂM THỬ (QA) | ĐẠI DIỆN NGƯỜI DÙNG CÁN BỘ (A03) | ĐẠI DIỆN CHỈ HUY ĐƠN VỊ (A01) |
|:---:|:---:|:---:|
| *(Ký và ghi rõ họ tên)* | *(Ký và ghi rõ họ tên)* | *(Ký và ghi rõ họ tên)* |
| <br><br><br><br> | <br><br><br><br> | <br><br><br><br> |
| **QA Lead** | **Cán bộ Kiểm tra Địa bàn** | **Chỉ huy Đội / Trưởng phòng PC07** |
| Ngày: ..... / ..... / 2026 | Ngày: ..... / ..... / 2026 | Ngày: ..... / ..... / 2026 |
