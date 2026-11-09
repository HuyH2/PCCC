# Đặc tả Chức năng (Functional Specification)
# Hệ thống Quản lý PCCC & CNCH — PC07 / Đội Khu vực 10

> Phiên bản: 1.0 | Ngày: 04/11/2026 | Trạng thái: Dựa trên triển khai thực tế

---

## 1. Tổng quan hệ thống

### 1.1 Mục tiêu

Hệ thống Quản lý PCCC & CNCH số hóa toàn bộ công tác phòng cháy chữa cháy và cứu nạn cứu hộ cho PC07/Đội Khu vực 10, gồm 11 phân hệ nghiệp vụ từ quản lý tài khoản đến sự cố.

### 1.2 Phạm vi

- **11 Phân hệ (M01–M11):** Quản trị, Tổ chức, Cơ sở, Vi phạm, Văn bản, Kiểm tra, Công việc, Báo cáo, Sự cố, Dashboard, Số hóa
- **7 Vai trò:** A01 Chỉ huy, A02 Tổ trưởng/Phó chỉ huy, A03 Cán bộ kiểm tra, A04 Cán bộ tổng hợp, A05 Quản trị, A06 Người xem, A07 (chưa kích hoạt)
- **Nền tảng:** Web responsive, hỗ trợ mobile (PWA)
- **Giai đoạn hiện tại:** Triển khai cốt lõi M01, M02 (một phần), M03, M05, M06, M07, M10

### 1.3 Các thành phần kỹ thuật

| Thành phần | Công nghệ | Phiên bản |
|-----------|----------|----------|
| Frontend | Next.js App Router, React, TypeScript strict | Next.js 16, React 19 |
| UI | Tailwind CSS v4, shadcn/ui + Radix, Recharts | — |
| Form | react-hook-form + Zod | — |
| Backend | Node.js ESM, node:http, node:sqlite (DatabaseSync) | Node.js ≥ 22.13.0 |
| Database | SQLite (file: `pccc-BE/data/pccc.sqlite`) | — |
| Package manager | pnpm (monorepo) | — |

---

## 2. Kiến trúc kỹ thuật

### 2.1 Luồng dữ liệu tổng thể

```
Browser
  ↓ /api/* (Next.js rewrite → BACKEND_URL:4000)
Backend (node:http)
  ↓ Xác thực session (pccc_session cookie)
  ↓ Kiểm tra quyền (RBAC + scope)
  ↓ Validate input
  ↓ SQLite query
  ↑ JSON response { data } hoặc { error: { code, message } }
```

### 2.2 Bảo mật

- Session HttpOnly cookie `pccc_session`, TTL cấu hình qua `SESSION_TTL_SECONDS`
- Kiểm tra `Origin` header cho mọi mutation
- Không trả stack trace hay secret cho client
- File nhạy cảm (PDF, biên bản) chỉ trả khi có quyền, lưu BLOB trong SQLite
- Audit log append-only cho mọi thao tác quan trọng

### 2.3 Cấu trúc module backend

```
pccc-BE/src/
├── app.js              ← HTTP server, routes bảng
├── core/               ← database, errors, validation, password, http
└── modules/
    ├── auth/           ← Đăng nhập, session, đổi mật khẩu
    ├── authorization/  ← RBAC, scope, tài khoản, khóa
    ├── administration/ ← Chuyển giao phạm vi
    ├── facilities/     ← Cơ sở, nhân sự, tài liệu, trạng thái
    ├── search/         ← Tra cứu toàn hệ thống
    ├── dashboard/      ← Số liệu tổng quan
    ├── audit/          ← Nhật ký thao tác
    ├── legal-documents/← Kho văn bản M05
    ├── inspections/    ← Thực hiện kiểm tra M06
    ├── inspection-planning/ ← Lập kế hoạch M06
    ├── tasks/          ← Giao việc, tiến độ, trao đổi M07
    ├── violations/     ← Vi phạm, đình chỉ M04
    ├── incidents/      ← Sự cố M09
    ├── regions/        ← Khu vực/khu phố
    ├── organization/   ← Cơ cấu tổ chức M02
    ├── reports/        ← Báo cáo M08
    ├── kpi/            ← KPI công việc
    └── notifications/  ← Thông báo
```

---

## 3. Ma trận Vai trò & Phân quyền (RBAC)

> **Lưu ý:** Ma trận này dựa trên thiết kế triển khai thực tế và seed demo.
> Ma trận quyền chính thức (Q02) vẫn cần xác nhận nghiệp vụ.

### 3.1 Phạm vi dữ liệu (Data Scope)

| Scope | Mô tả |
|-------|-------|
| `all` | Toàn bộ dữ liệu hệ thống |
| `unit` | Phạm vi đơn vị (Đội) |
| `region` | Phạm vi khu vực/khu phố |
| `facility` | Phạm vi từng cơ sở cụ thể |

### 3.2 Ma trận quyền theo phân hệ

| Phân hệ | A01 Chỉ huy | A02 Tổ trưởng | A03 CB Kiểm tra | A04 CB Tổng hợp | A05 Quản trị | A06 Người xem |
|---------|------------|--------------|----------------|----------------|-------------|--------------|
| **M01** Quản trị | Xem | — | — | — | Xem + Sửa + Duyệt | — |
| **M02** Tổ chức | Xem + Sửa | Xem | Xem | Xem + Sửa | Xem + Sửa | Xem |
| **M03** Cơ sở | Xem + Sửa + Tạo | Xem + Sửa | Xem | Xem + Sửa | Xem + Sửa | Xem |
| **M04** Vi phạm | Xem + Duyệt | Xem + Sửa | Xem + Sửa | Xem + Sửa | Xem | Xem |
| **M05** Văn bản | Xem + Tạo + Sửa | Xem | Xem | Xem | Xem + Tạo + Sửa | Xem |
| **M06** Kiểm tra | Xem + Tạo + Sửa | Xem + Tạo + Sửa | Xem + Sửa | Xem | Xem | Xem |
| **M07** Công việc | Xem + Tạo + Sửa | Xem + Tạo + Sửa | Xem + Sửa | Xem + Sửa | Xem | Xem |
| **M08** Báo cáo | Xem + Tạo + Duyệt | Xem + Tạo | Xem | Xem + Tạo | Xem | Xem |
| **M09** Sự cố | Xem + Tạo + Sửa | Xem + Tạo | Xem + Tạo | Xem + Sửa | Xem | Xem |
| **M10** Dashboard | Xem | Xem | Xem | Xem | Xem | Xem |
| **M11** Số hóa | Xem | Xem | — | Xem + Tạo | Xem + Tạo | — |

---

## 4. Luồng Nghiệp vụ Chính

### 4.1 Luồng Đăng nhập & Xác thực (M01)

```
Người dùng → /dang-nhap → [Nhập username/password]
  → Backend: bcrypt verify → Tạo session cookie
  → Có yêu cầu đổi mật khẩu? → /doi-mat-khau → [Nhập mật khẩu mới]
  → Đã hoàn thành → Redirect về /
```

### 4.2 Luồng Quản lý Cơ sở (M03)

```
Danh sách /co-so → [Lọc/Tìm kiếm theo scope]
  → Thêm cơ sở mới: [Form nhập thông tin] → Validate → Lưu DB
  → Chi tiết cơ sở:
      ├── Tab Thông tin: [Xem/Sửa hồ sơ]
      ├── Tab Nhân sự: [Danh sách] → Thêm/Sửa/Ngưng hoạt động nhân sự
      ├── Tab Tài liệu: [Upload PDF/ảnh ≤10MB] → Xem/Tải
      ├── Tab Trạng thái: [Lịch sử đình chỉ/hoạt động lại]
      └── Tab Lịch sử: [Timeline quyết định]
```

### 4.3 Luồng Kiểm tra PCCC (M06)

```
Lập kế hoạch (/kiem-tra/ke-hoach):
  → Tạo kế hoạch năm/tháng → Phân công cơ sở kiểm tra

Thực hiện kiểm tra (/kiem-tra/thuc-hien):
  [planned] → Chọn checklist → Lưu nháp [in_progress]
           → Đánh giá từng mục checklist
           → Tải biên bản/tài liệu
           → Chốt kết quả [evaluated]
           → Nhập kết luận (pass/conditional/fail)
           → Hoàn thành [completed]
           → (Nếu cần) Tạo hậu kiểm → Cập nhật kết quả hậu kiểm

Kiểm tra đột xuất/chuyên đề:
  → POST /api/inspections { kind: 'unscheduled'/'thematic' }
  → Tiếp tục như trên
```

### 4.4 Luồng Văn bản pháp luật (M05)

```
Kho văn bản (/van-ban):
  → Tìm kiếm/lọc (theo loại, trạng thái)
  → Xem chi tiết → Tải PDF (kiểm quyền)
  → Xem lịch sử thay đổi

Quản lý (A01/A05):
  → /van-ban/them: [Nhập thông tin + upload PDF]
  → /van-ban/[id]/sua: [Cập nhật + tăng version]
  → Thay file PDF mới
```

### 4.5 Luồng Giao việc & Tiến độ (M07)

```
Giao việc (/cong-viec/giao-viec):
  → Tạo task → Giao cho cán bộ → [Cán bộ nhận việc]
  → Cập nhật tiến độ → Trao đổi theo thread
  → Hoàn thành → Đánh giá KPI
```

### 4.6 Luồng Vi phạm - Đình chỉ (M04)

```
Phát hiện vi phạm → /vi-pham → Lập hồ sơ vi phạm
  → Quyết định xử phạt → Theo dõi khắc phục
  → [Đình chỉ] → POST /api/facilities/:id/status { status: 'suspended' }
  → [Khắc phục đủ điều kiện] → POST /api/facilities/:id/status { status: 'active' }
  → Duyệt hoạt động lại (A01/A05)
```

---

## 5. Mô tả Chi tiết Use Cases

### M01 — Quản trị & Phân quyền

**UC-ADM-01: Đăng nhập & Xác thực**
- **Actor:** Mọi vai trò
- **Flow:** Nhập username/password → Xác thực bcrypt → Tạo session HttpOnly → Redirect về dashboard
- **Lỗi:** Sai thông tin: 401; Tài khoản bị khóa: 403 ACCOUNT_LOCKED
- **Trạng thái:** ✅ Đã triển khai đầy đủ

**UC-ADM-02: Quản lý Tài khoản**
- **Actor:** A05
- **Flow:** Xem danh sách → Tạo tài khoản (gán vai trò) → Kích hoạt/Ngưng → Đặt lại mật khẩu
- **Trạng thái:** ✅ Đã triển khai đầy đủ

**UC-ADM-03: Phân quyền Vai trò & Phạm vi**
- **Actor:** A05
- **Flow:** Chọn tài khoản → Gán vai trò (A01-A06) → Cấu hình phạm vi (all/unit/region/facility) → Lưu
- **Trạng thái:** ✅ Đã triển khai đầy đủ

**UC-ADM-04: Chuyển giao Phạm vi / Khóa tài khoản**
- **Actor:** A05 (cần `M01.edit`)
- **Flow:** Chọn cán bộ nguồn → Chọn khu vực/cơ sở → Chọn cán bộ đích → Xác nhận → Atomic transfer
- **Điều kiện:** Cả hai tài khoản đang hoạt động; không phải cùng cán bộ
- **Trạng thái:** ✅ Đã triển khai đầy đủ

**UC-ADM-05: Đổi mật khẩu**
- **Actor:** Mọi vai trò
- **Flow:** Nhập mật khẩu cũ → Nhập mới (xác nhận) → Lưu
- **Quy tắc:** Q13 — tài khoản nội bộ có thể bỏ qua lần đầu
- **Trạng thái:** ✅ Đã triển khai

---

### M03 — Cơ sở & Hồ sơ

**UC-FAC-01: Danh sách & Tra cứu Cơ sở**
- **Actor:** Mọi vai trò (theo scope)
- **Flow:** Vào /co-so → Lọc theo tên/địa chỉ/trạng thái/khu vực → Phân trang
- **Trạng thái:** ✅ Đã triển khai đầy đủ

**UC-FAC-02: Thêm/Sửa hồ sơ Cơ sở**
- **Actor:** A01, A02, A04, A05
- **Thông tin:** Tên, địa chỉ, loại cơ sở, người phụ trách, khu vực, trạng thái
- **Trạng thái:** ✅ Đã triển khai đầy đủ

**UC-FAC-03: Nhân sự & Điều kiện PCCC**
- **Actor:** A01, A02, A04, A05
- **Thông tin nhân sự:** Họ tên, vai trò, chức vụ, liên hệ, số chứng chỉ, ngày cấp/hết hạn
- **Quy tắc:** Mỗi cơ sở có tối đa 1 người đứng đầu đang hoạt động (unique constraint)
- **Trạng thái:** ✅ Đã triển khai đầy đủ

**UC-FAC-06: Tài liệu Đính kèm Cơ sở**
- **Actor:** A01, A02, A04, A05
- **Định dạng:** PDF, ảnh (JPEG/PNG), Word (.doc/.docx), Excel (.xls/.xlsx)
- **Giới hạn:** Tối đa 10MB mỗi file
- **Trạng thái:** ✅ Đã triển khai đầy đủ

---

### M05 — Văn bản Pháp luật

**UC-DOC-01: Kho Văn bản**
- **Actor:** Mọi vai trò có `M05.view` + scope không rỗng
- **Thông tin:** Loại, tên/trích yếu, số/ký hiệu (unique), cơ quan, ngày ban hành, hiệu lực, trạng thái (pending/effective/expired), link, PDF
- **Trạng thái:** ✅ Đã triển khai đầy đủ

**UC-DOC-02: Quản lý Văn bản**
- **Actor:** A01, A05 (cần `M05.create`/`M05.edit`)
- **Quy tắc:** Version conflict → 409; PDF ≤5MB; kiểm tra magic bytes `%PDF-` và `%%EOF`
- **Trạng thái:** ✅ Đã triển khai đầy đủ

---

### M06 — Công tác Kiểm tra

**UC-INS-06: Checklist Kiểm tra**
- **Actor:** A01, A02 (tạo); mọi vai trò M06.view (đọc)
- **Thông tin:** Tên checklist, loại cơ sở, từng mục (nội dung, hướng dẫn, căn cứ pháp lý, bắt buộc/không)
- **Trạng thái:** ✅ Đã triển khai đầy đủ

**UC-INS-07/08: Thực hiện Kiểm tra**
- **Actor:** A03 (thực hiện), A01/A02 (giám sát)
- **Quy trình:** planned → in_progress → evaluated → completed
- **Điều kiện hoàn thành (BR-02):** Checklist chốt + kết quả + kết luận + ≥1 biên bản
- **Trạng thái:** ✅ Đã triển khai đầy đủ

---

### M07 — Lịch - Công việc - KPI

**UC-WRK-02: Giao việc & Tiến độ**
- **Actor:** A01, A02 (giao); A03, A04 (thực hiện)
- **Flow:** Tạo task → Giao → Nhận → Cập nhật % → Hoàn thành
- **Trạng thái:** ✅ Có API và UI cơ bản

**UC-WRK-03: Trao đổi theo Công việc**
- **Actor:** Mọi thành viên liên quan task
- **Flow:** Thread tin nhắn per task; không xóa tin
- **Trạng thái:** ✅ Đã triển khai đầy đủ

---

## 6. Các Điểm Chưa Xác nhận

| ID | Mô tả | Mức ảnh hưởng |
|----|-------|---------------|
| Q01 | URD v1.0 đầy đủ chưa đọc được; 55 UC có thể chưa đủ | Cao |
| Q02 | Ma trận quyền A01-A07 × M01-M11 chưa được xác nhận chính thức | Cao |
| Q04 | Nội dung checklist kiểm tra chuẩn theo pháp lý | Trung bình |
| Q05 | Chu kỳ kiểm tra định kỳ theo loại cơ sở | Trung bình |
| Q06 | Mẫu báo cáo định kỳ chính thức | Trung bình |
| Q13 | Tài khoản nội bộ có thể bỏ qua đổi mật khẩu lần đầu | Thấp |
| Q15 | Thời hạn chứng chỉ huấn luyện PCCC (R-306: không hard-code) | Trung bình |

---

*Tài liệu này mô tả trạng thái triển khai thực tế, không phải thiết kế tương lai.
Chức năng ở trạng thái ⚠️ hoặc ❌ trong RTM không được đánh dấu là "hoàn thành".*
