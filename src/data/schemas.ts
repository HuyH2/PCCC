/**
 * Ràng buộc dữ liệu cho các biểu mẫu nhập liệu.
 *
 * Bộ trường bắt buộc dưới đây là mức đề xuất suy ra từ bảng thực thể ở URD mục 5.
 * Bộ trường chuẩn chính thức là điểm cần xác nhận Q04 — khi đơn vị chốt, chỉ cần
 * sửa ở file này là toàn bộ biểu mẫu có hiệu lực theo.
 */
import { z } from "zod";

const batBuoc = (ten: string) => z.string().trim().min(1, `Vui lòng nhập ${ten}`);

const dienThoaiVN = z
  .string()
  .trim()
  .regex(/^0\d{2}[\s.]?\d{3}[\s.]?\d{3,4}$/, "Số điện thoại không hợp lệ (ví dụ: 0903 112 007)");

/* --------------------------------- Cơ sở -------------------------------- */
export const coSoSchema = z.object({
  ten: batBuoc("tên cơ sở").min(3, "Tên cơ sở tối thiểu 3 ký tự"),
  diaChi: batBuoc("địa chỉ"),
  loaiHinh: batBuoc("loại hình cơ sở"),
  phuongId: batBuoc("phường"),
  khuVucId: batBuoc("khu phố"),
  canBoPhuTrachId: batBuoc("cán bộ phụ trách"),
  trangThai: batBuoc("trạng thái hoạt động"),
  nguoiDungDau: batBuoc("họ tên người đứng đầu"),
  dienThoai: dienThoaiVN,
  soTang: z.coerce.number().int("Số tầng phải là số nguyên").min(1, "Số tầng tối thiểu là 1").max(100, "Số tầng không hợp lệ"),
  dienTich: z.coerce.number().min(1, "Diện tích phải lớn hơn 0").max(500_000, "Diện tích không hợp lệ"),
  ngayKiemTraGanNhat: z.string().optional(),
  ngayKiemTraKeTiep: z.string().optional(),
  ghiChu: z.string().max(1000, "Ghi chú tối đa 1000 ký tự").optional(),
});
export type CoSoFormValues = z.infer<typeof coSoSchema>;

/* --------------------------------- Cán bộ ------------------------------- */
export const canBoSchema = z.object({
  ma: batBuoc("mã số cán bộ"),
  hoTen: batBuoc("họ và tên").min(3, "Họ tên tối thiểu 3 ký tự"),
  capBac: batBuoc("cấp bậc"),
  chucVu: batBuoc("chức vụ"),
  dienThoai: dienThoaiVN,
  email: z.string().trim().email("Email không hợp lệ"),
  donViId: batBuoc("đơn vị"),
  vaiTro: batBuoc("vai trò"),
  trangThai: batBuoc("trạng thái"),
  ghiChu: z.string().max(500, "Ghi chú tối đa 500 ký tự").optional(),
});
export type CanBoFormValues = z.infer<typeof canBoSchema>;

/* -------------------------------- Vi phạm ------------------------------- */
export const viPhamSchema = z
  .object({
    coSoId: batBuoc("cơ sở vi phạm"),
    loai: batBuoc("loại vi phạm"),
    mucDo: batBuoc("mức độ"),
    ngayPhatHien: batBuoc("ngày phát hiện"),
    soQuyetDinh: z.string().trim().optional(),
    dinhChi: z.boolean(),
    hanKhacPhuc: z.string().trim().optional(),
    canBoTheoDoiId: batBuoc("cán bộ theo dõi"),
    noiDung: batBuoc("nội dung vi phạm").min(10, "Mô tả tối thiểu 10 ký tự"),
  })
  // BR-09: hồ sơ đình chỉ phải có số quyết định làm căn cứ
  .refine((v) => !v.dinhChi || (v.soQuyetDinh ?? "").length > 0, {
    message: "Hồ sơ đình chỉ bắt buộc có số quyết định",
    path: ["soQuyetDinh"],
  })
  // Hạn khắc phục không được nằm trước ngày phát hiện
  .refine((v) => !v.hanKhacPhuc || v.hanKhacPhuc >= v.ngayPhatHien, {
    message: "Hạn khắc phục phải sau ngày phát hiện",
    path: ["hanKhacPhuc"],
  });
export type ViPhamFormValues = z.infer<typeof viPhamSchema>;

/* ------------------------------- Kiểm tra ------------------------------- */
export const cuocKiemTraSchema = z.object({
  coSoId: batBuoc("cơ sở được kiểm tra"),
  loai: batBuoc("loại kiểm tra"),
  ngayKiemTra: batBuoc("ngày kiểm tra"),
  truongDoanId: batBuoc("trưởng đoàn kiểm tra"),
  noiDung: batBuoc("nội dung kiểm tra").min(10, "Nội dung tối thiểu 10 ký tự"),
  thongBaoTruoc: z.boolean(),
});
export type CuocKiemTraFormValues = z.infer<typeof cuocKiemTraSchema>;

/* ------------------------------- Công việc ------------------------------ */
export const congViecSchema = z
  .object({
    tieuDe: batBuoc("tiêu đề công việc").min(5, "Tiêu đề tối thiểu 5 ký tự"),
    loai: batBuoc("loại công việc"),
    nguoiThucHienId: batBuoc("người thực hiện"),
    ngayGiao: batBuoc("ngày giao"),
    hanHoanThanh: batBuoc("hạn hoàn thành"),
    moTa: z.string().max(2000, "Mô tả tối đa 2000 ký tự").optional(),
  })
  .refine((v) => v.hanHoanThanh >= v.ngayGiao, {
    message: "Hạn hoàn thành phải sau hoặc bằng ngày giao",
    path: ["hanHoanThanh"],
  });
export type CongViecFormValues = z.infer<typeof congViecSchema>;

/* -------------------------------- Báo cáo ------------------------------- */
export const baoCaoSchema = z.object({
  ten: batBuoc("tên báo cáo").min(5, "Tên báo cáo tối thiểu 5 ký tự"),
  chuKy: batBuoc("chu kỳ"),
  noiNhan: batBuoc("nơi nhận"),
  soVanBanYeuCau: z.string().trim().optional(),
  hanNop: batBuoc("hạn nộp"),
  nguoiPhuTrachId: batBuoc("người phụ trách"),
  soNgayCanhBao: z.coerce
    .number()
    .int("Số ngày phải là số nguyên")
    .min(1, "Tối thiểu 1 ngày")
    .max(30, "Tối đa 30 ngày"),
  coBieuMau: z.boolean(),
});
export type BaoCaoFormValues = z.infer<typeof baoCaoSchema>;

/* --------------------------------- Sự cố -------------------------------- */
export const suCoSchema = z.object({
  loai: batBuoc("loại sự cố"),
  ngay: batBuoc("ngày xảy ra"),
  gio: batBuoc("giờ xảy ra"),
  diaChi: batBuoc("địa chỉ xảy ra"),
  phuongId: batBuoc("phường"),
  coSoId: z.string().optional(),
  nguyenNhan: batBuoc("nguyên nhân"),
  soNguoiChet: z.coerce.number().int().min(0, "Không được âm").max(999),
  soNguoiBiThuong: z.coerce.number().int().min(0, "Không được âm").max(999),
  thietHaiTaiSan: z.coerce.number().min(0, "Không được âm"),
  dienTichChay: z.coerce.number().min(0, "Không được âm"),
  canBoXuLyId: batBuoc("cán bộ xử lý"),
  hanXuLy: batBuoc("hạn xử lý hồ sơ"),
});
export type SuCoFormValues = z.infer<typeof suCoSchema>;
