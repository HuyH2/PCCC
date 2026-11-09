# Hướng dẫn Sử dụng Hệ thống
# Hệ thống Quản lý PCCC & CNCH — PC07 / Đội Khu vực 10

> Phiên bản: 1.0 | Ngày: 04/11/2026

---

## Mục lục

1. [Giới thiệu chung](#1-giới-thiệu-chung)
2. [Đăng nhập hệ thống](#2-đăng-nhập-hệ-thống)
3. [A05 — Quản trị viên](#3-a05--quản-trị-viên)
4. [A01 — Chỉ huy](#4-a01--chỉ-huy)
5. [A02 — Tổ trưởng / Phó chỉ huy](#5-a02--tổ-trưởng--phó-chỉ-huy)
6. [A03 — Cán bộ Kiểm tra](#6-a03--cán-bộ-kiểm-tra)
7. [A04 — Cán bộ Tổng hợp](#7-a04--cán-bộ-tổng-hợp)
8. [A06 — Người xem](#8-a06--người-xem)
9. [Chức năng dùng chung](#9-chức-năng-dùng-chung)

---

## 1. Giới thiệu chung

Hệ thống Quản lý PCCC & CNCH là ứng dụng web hỗ trợ toàn bộ nghiệp vụ phòng cháy chữa cháy và cứu nạn cứu hộ. Hệ thống hoạt động trên trình duyệt web (Chrome, Edge, Firefox) và hỗ trợ thiết bị di động.

**Địa chỉ truy cập:** Theo cấu hình của đơn vị (mặc định `http://localhost:3000`)

**Yêu cầu:** Tài khoản được cấp bởi Quản trị viên hệ thống

---

## 2. Đăng nhập hệ thống

### Bước 1: Truy cập trang đăng nhập
Mở trình duyệt, nhập địa chỉ hệ thống. Hệ thống tự động chuyển đến trang đăng nhập.

### Bước 2: Nhập thông tin
- **Tên đăng nhập:** Do Quản trị viên cấp
- **Mật khẩu:** Mật khẩu cá nhân

### Bước 3: Đổi mật khẩu lần đầu (nếu có)
Nếu Quản trị viên yêu cầu đổi mật khẩu, hệ thống sẽ chuyển đến trang `/doi-mat-khau`:
1. Nhập mật khẩu hiện tại
2. Nhập mật khẩu mới (tối thiểu 8 ký tự)
3. Xác nhận mật khẩu mới
4. Nhấn **Đổi mật khẩu**

### Bước 4: Vào hệ thống
Sau đăng nhập thành công, hệ thống chuyển đến **Tổng quan (Dashboard)**.

### Lỗi đăng nhập thường gặp
| Thông báo | Nguyên nhân | Cách xử lý |
|-----------|------------|-----------|
| Sai tên đăng nhập hoặc mật khẩu | Nhập sai | Kiểm tra lại thông tin |
| Tài khoản bị khóa | Quản trị đã khóa | Liên hệ Quản trị viên |
| Phiên đăng nhập hết hạn | TTL session quá hạn | Đăng nhập lại |

---

## 3. A05 — Quản trị viên

**Phạm vi:** Toàn hệ thống (scope: all)
**Menu:** Điều hành + Quản trị + Văn bản + Cơ sở

### 3.1 Quản lý Tài khoản (`/quan-tri/tai-khoan`)

#### Tạo tài khoản mới
1. Vào **Quản trị → Tài khoản**
2. Nhấn **Thêm tài khoản**
3. Điền thông tin: Tên đăng nhập, Họ tên, Email (tùy chọn)
4. Chọn trạng thái ban đầu
5. Nhấn **Lưu**
6. Hệ thống tạo tài khoản với mật khẩu tạm thời

#### Khóa / Mở khóa tài khoản
1. Tìm tài khoản cần khóa
2. Nhấn **Khóa tài khoản**
3. Xác nhận → Hệ thống thu hồi mọi phiên đang hoạt động
4. Để mở: Nhấn **Mở khóa** (chỉ áp dụng tài khoản đang bị khóa)

### 3.2 Phân quyền Vai trò & Phạm vi (`/quan-tri/vai-tro`)

1. Vào **Quản trị → Vai trò & Phạm vi**
2. Chọn tài khoản cần cấu hình
3. **Vai trò:** Chọn từ A01–A06
4. **Phạm vi:** Chọn loại scope và đối tượng cụ thể (khu vực/cơ sở)
5. **Quyền phân hệ:** Tick vào từng quyền (view/create/edit) cho từng phân hệ
6. Nhấn **Lưu**

> **Lưu ý:** Thay đổi quyền có hiệu lực ngay; người dùng cần tải lại trang

### 3.3 Chuyển giao Phạm vi (`/quan-tri/tai-khoan` → Chuyển giao)

**Điều kiện:** Cả hai tài khoản đang hoạt động và khác nhau

1. Chọn **Cán bộ chuyển (nguồn)**
2. Chọn khu vực/cơ sở cần chuyển giao
3. Chọn **Cán bộ nhận (đích)**
4. Nhập lý do chuyển giao (bắt buộc)
5. Nhấn **Xác nhận chuyển giao**
6. Hệ thống cập nhật atomic (nếu dữ liệu thay đổi giữa chừng → thông báo lại)

### 3.4 Nhật ký Thao tác (`/quan-tri/nhat-ky`)

- Xem toàn bộ log hệ thống
- Lọc theo: Người thực hiện, Phân hệ, Hành động, Thời gian
- Nhật ký không được sửa/xóa

### 3.5 Quản lý Văn bản Pháp luật (`/van-ban`)

Xem mục [4.3 Chỉ huy — Văn bản](#43-văn-bản-pháp-luật-van-ban) (quyền tương tự A01)

---

## 4. A01 — Chỉ huy

**Phạm vi:** Đơn vị (scope: unit) hoặc rộng hơn
**Menu:** Điều hành + Địa bàn + Nghiệp vụ + Văn bản

### 4.1 Tổng quan Dashboard (`/`)

- Xem số liệu tổng hợp: cơ sở theo trạng thái, kiểm tra trong tháng, vi phạm đang xử lý
- Nhấn vào từng thẻ để xem chi tiết
- Dữ liệu cập nhật thời gian thực từ database

### 4.2 Quản lý Cơ sở (`/co-so`)

#### Xem danh sách cơ sở
1. Vào **Cơ sở & Hồ sơ**
2. Lọc theo: Tên, địa chỉ, trạng thái (hoạt động/đình chỉ), khu vực
3. Nhấn vào cơ sở để xem chi tiết

#### Xem chi tiết cơ sở
Trang chi tiết có các tab:
- **Thông tin:** Hồ sơ cơ bản, người phụ trách
- **Nhân sự:** Danh sách nhân sự, chứng chỉ PCCC
- **Tài liệu:** File đính kèm (giấy phép, chứng chỉ, biên bản...)
- **Vi phạm:** Lịch sử vi phạm
- **Lịch sử:** Timeline trạng thái cơ sở

#### Thêm/Sửa cơ sở
1. Nhấn **Thêm cơ sở** hoặc **Sửa**
2. Điền các trường bắt buộc (đánh dấu `*`)
3. Nhấn **Lưu**

### 4.3 Văn bản Pháp luật (`/van-ban`)

#### Xem danh sách
- Lọc theo: Loại văn bản, trạng thái (chưa hiệu lực/còn hiệu lực/hết hiệu lực), từ khóa
- Nhấn vào văn bản để xem chi tiết
- Nút **Tải PDF** (nếu có file)

#### Thêm văn bản mới
1. Nhấn **Thêm văn bản**
2. Điền: Loại, Tên/Trích yếu, Số/Ký hiệu (**duy nhất**), Cơ quan ban hành, Ngày ban hành, Ngày hiệu lực, Trạng thái
3. Nhập link nguồn **hoặc** upload file PDF (≤5MB)
4. Nhấn **Lưu**

#### Sửa văn bản
1. Vào trang chi tiết → Nhấn **Sửa**
2. Thay đổi thông tin
3. Nhấn **Lưu** (hệ thống kiểm tra version; nếu người khác sửa trước → thông báo tải lại)

### 4.4 Lập kế hoạch Kiểm tra (`/kiem-tra/ke-hoach`)

1. Tạo kế hoạch năm/tháng
2. Phân bổ chỉ tiêu kiểm tra
3. Phân công cán bộ, cơ sở kiểm tra

### 4.5 Duyệt Đình chỉ / Hoạt động lại Cơ sở

Thực hiện qua trang **Vi phạm - Đình chỉ** (`/vi-pham`):
1. Chọn cơ sở cần đình chỉ/hoạt động lại
2. Nhấn **Đình chỉ** / **Cho hoạt động lại**
3. Nhập lý do và số quyết định
4. Xác nhận

---

## 5. A02 — Tổ trưởng / Phó chỉ huy

**Phạm vi:** Khu vực được phân công
**Menu:** Điều hành + Địa bàn + Nghiệp vụ

### 5.1 Phân công Kiểm tra

1. Vào **Công tác kiểm tra → Cuộc kiểm tra**
2. Xem danh sách cuộc kiểm tra cần phân công
3. Mở cuộc kiểm tra → Chọn cán bộ trưởng đoàn và thành viên
4. Lưu phân công

### 5.2 Tạo Checklist Kiểm tra (`/kiem-tra/checklist`)

1. Nhấn **Tạo checklist**
2. Đặt tên, chọn loại cơ sở áp dụng
3. Thêm các mục kiểm tra:
   - Nội dung mục (bắt buộc)
   - Hướng dẫn thực hiện (tùy chọn)
   - Căn cứ pháp lý (tùy chọn)
   - Đánh dấu bắt buộc/không bắt buộc
4. Lưu checklist (1–100 mục)

### 5.3 Giao việc (`/cong-viec/giao-viec`)

1. Nhấn **Giao việc mới**
2. Điền: Tiêu đề, Mô tả, Hạn hoàn thành, Cán bộ thực hiện
3. Lưu → Cán bộ được thông báo

---

## 6. A03 — Cán bộ Kiểm tra

**Phạm vi:** Cơ sở được phân công
**Menu:** Nghiệp vụ → Thực hiện kiểm tra + Công việc

### 6.1 Thực hiện Kiểm tra (`/kiem-tra/thuc-hien`)

#### Bắt đầu kiểm tra
1. Chọn cuộc kiểm tra được phân công (trạng thái `Lên kế hoạch`)
2. Nhấn **Bắt đầu kiểm tra**
3. Chọn checklist áp dụng
4. Trạng thái chuyển sang **Đang thực hiện**

#### Đánh giá checklist
1. Với từng mục kiểm tra:
   - Chọn kết quả: **Đạt** / **Không đạt** / **Không áp dụng**
   - Nhập ghi chú (tùy chọn)
2. Lưu nháp để tiếp tục sau

#### Tải biên bản / Tài liệu
1. Nhấn **Tải lên tài liệu**
2. Chọn loại: **Biên bản** (record) / **Bằng chứng** (evidence)
3. Nếu là biên bản: nhập số biên bản (bắt buộc)
4. Chọn file (PDF/JPEG/PNG)
5. Tải lên

#### Chốt kết quả
1. Đảm bảo tất cả mục **bắt buộc** đã được đánh giá (không để `pending`)
2. Nhấn **Chốt kết quả** → Trạng thái `Đã đánh giá`
3. Checklist bị khóa, không sửa được

#### Nhập kết luận
1. Chọn kết quả tổng: **Đạt** / **Có điều kiện** / **Không đạt**
2. Nhập nội dung kết luận
3. Lưu kết luận

#### Hoàn thành kiểm tra
**Điều kiện bắt buộc:**
- ✅ Đã chốt kết quả checklist
- ✅ Đã có kết quả và kết luận
- ✅ Có ít nhất 1 biên bản (tài liệu loại `record`)

Nhấn **Hoàn thành** → Trạng thái `Hoàn thành`

#### Tạo hậu kiểm (nếu cần)
1. Sau khi hoàn thành → Nhấn **Tạo hậu kiểm**
2. Nhập yêu cầu và hạn hậu kiểm
3. Khi hậu kiểm xong: Cập nhật kết quả (Giải quyết / Chưa giải quyết)

### 6.2 Kiểm tra Đột xuất / Chuyên đề

1. Vào **Thực hiện kiểm tra**
2. Nhấn **Tạo kiểm tra đột xuất** / **Tạo kiểm tra chuyên đề**
3. Chọn cơ sở, nhập lý do, ngày thực hiện
4. Tiếp tục như quy trình kiểm tra thông thường

### 6.3 Trao đổi Công việc

1. Vào **Giao việc & Tiến độ → [Tên task]**
2. Xem thread trao đổi
3. Nhập tin nhắn → Gửi
4. Cập nhật % tiến độ

---

## 7. A04 — Cán bộ Tổng hợp

**Phạm vi:** Theo phân công
**Menu:** Toàn bộ menu (đọc) + tạo/sửa một số phân hệ

### 7.1 Quản lý Cơ sở

Tương tự A01/A02 (xem mục 4.2), nhưng phạm vi theo scope được cấp.

### 7.2 Quản lý Nhân sự Cơ sở

1. Vào cơ sở → Tab **Nhân sự**
2. **Thêm nhân sự:**
   - Họ tên, vai trò (trưởng cơ sở/nhân viên/khác), chức vụ
   - Số điện thoại, email (tùy chọn)
   - Số chứng chỉ huấn luyện PCCC, ngày cấp, ngày hết hạn (tùy chọn)
3. **Ngưng hoạt động:** Nhấn **Ngưng** → Nhân sự không còn trong danh sách hoạt động
4. **Người đứng đầu:** Mỗi cơ sở chỉ có 1 người đứng đầu đang hoạt động

### 7.3 Upload Tài liệu Cơ sở

1. Vào cơ sở → Tab **Tài liệu**
2. Nhấn **Upload tài liệu**
3. Chọn loại tài liệu, nhập mô tả
4. Chọn file (PDF/ảnh/Word/Excel, tối đa 10MB)
5. Nhập ngày cấp / ngày hết hạn (nếu có)
6. Tải lên

### 7.4 Báo cáo (`/bao-cao`)

> **Lưu ý:** Chức năng báo cáo đầy đủ đang phát triển. Các chức năng hiện có: xem số liệu tổng hợp từ dashboard.

---

## 8. A06 — Người xem

**Phạm vi:** Theo scope được cấp (chỉ đọc)
**Menu:** Dashboard + Tra cứu + Cơ sở (xem) + Văn bản (xem) + Kiểm tra (xem)

### 8.1 Dashboard

Xem số liệu tổng quan. Không có quyền tạo/sửa.

### 8.2 Tra cứu toàn hệ thống (`/tra-cuu`)

1. Nhập từ khóa vào ô tìm kiếm
2. Hệ thống tìm trong: cơ sở, văn bản, cuộc kiểm tra, vi phạm
3. Kết quả chỉ hiển thị dữ liệu trong scope

### 8.3 Xem Cơ sở, Văn bản, Kiểm tra

Chỉ có quyền xem; không thấy nút Thêm/Sửa/Xóa.

---

## 9. Chức năng Dùng chung

### 9.1 Tra cứu toàn hệ thống (`/tra-cuu`)

Tất cả vai trò đều có quyền tra cứu trong phạm vi của mình.

### 9.2 Đổi mật khẩu

1. Nhấn vào avatar/tên người dùng góc trên phải
2. Chọn **Đổi mật khẩu**
3. Nhập mật khẩu cũ và mật khẩu mới (xác nhận)
4. Nhấn **Lưu**

### 9.3 Đăng xuất

Nhấn vào avatar → **Đăng xuất** → Session bị hủy ngay lập tức.

### 9.4 Responsive / Mobile

Hệ thống hỗ trợ điện thoại và máy tính bảng. Trên di động:
- Menu được thu gọn vào nút hamburger
- Bảng dữ liệu cuộn ngang
- Form nhập liệu tối ưu cho màn hình nhỏ

### 9.5 Thông báo lỗi

| Mã lỗi | Ý nghĩa |
|--------|---------|
| 401 | Chưa đăng nhập hoặc phiên hết hạn |
| 403 | Không có quyền thực hiện thao tác |
| 404 | Dữ liệu không tồn tại hoặc ngoài phạm vi |
| 409 | Xung đột dữ liệu (ví dụ: version conflict, trùng tên) |

---

*Hướng dẫn này mô tả chức năng đã triển khai thực tế.
Các chức năng đánh dấu ⚠️ trong RTM đang phát triển hoặc còn hạn chế.*
