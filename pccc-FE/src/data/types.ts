/**
 * Mô hình dữ liệu nghiệp vụ mức URD (mục 5 — URD v1.0).
 * Các kiểu dữ liệu ở đây bám theo bảng thực thể trong tài liệu,
 * dùng chung cho toàn bộ màn hình FE.
 */

export type ActorCode = "A01" | "A02" | "A03" | "A04" | "A05" | "A06" | "A07";

export type ModuleCode =
  | "M01" | "M02" | "M03" | "M04" | "M05" | "M06"
  | "M07" | "M08" | "M09" | "M10" | "M11";

/** Cấp đơn vị hành chính/tổ chức — 4 cấp theo lưu ý nghiệp vụ bổ sung của URD */
export type DonViCap = "Tỉnh/Thành phố" | "Khu vực" | "Phường" | "Khu phố";

export type TrangThaiChung = "Hoạt động" | "Ngưng hoạt động";

export interface DonVi {
  id: string;
  ma: string;
  ten: string;
  cap: DonViCap;
  donViChaId: string | null;
  nguoiPhuTrachId: string | null;
  trangThai: TrangThaiChung;
  soCoSo: number;
}

export type CapBac =
  | "Đại tá" | "Thượng tá" | "Trung tá" | "Thiếu tá"
  | "Đại úy" | "Thượng úy" | "Trung úy" | "Thiếu úy";

export interface CanBo {
  id: string;
  ma: string;
  hoTen: string;
  capBac: CapBac;
  chucVu: string;
  dienThoai: string;
  email: string;
  donViId: string;
  vaiTro: ActorCode;
  trangThai: "Đang công tác" | "Nghỉ phép" | "Chuyển công tác";
  ghiChu?: string;
}

export interface KhuVuc {
  id: string;
  ma: string;
  ten: string;
  phuongId: string;
  canBoPhuTrachId: string | null;
  soCoSo: number;
}

export type LoaiHinhCoSo =
  | "Chung cư/Nhà cao tầng"
  | "Chợ/Trung tâm thương mại"
  | "Cơ sở giáo dục"
  | "Cơ sở y tế"
  | "Khách sạn/Nhà nghỉ"
  | "Karaoke/Vũ trường"
  | "Nhà xưởng/Kho"
  | "Trạm xăng dầu"
  | "Văn phòng/Trụ sở"
  | "Nhà ở kết hợp kinh doanh";

export type TrangThaiCoSo =
  | "Đang hoạt động"
  | "Đang đình chỉ"
  | "Tạm ngừng"
  | "Không phép";

export interface CoSo {
  id: string;
  ma: string;
  ten: string;
  diaChi: string;
  loaiHinh: LoaiHinhCoSo;
  khuVucId: string;
  phuongId: string;
  canBoPhuTrachId: string;
  trangThai: TrangThaiCoSo;
  nguoiDungDau: string;
  dienThoai: string;
  soTang: number;
  dienTich: number;
  ngayKiemTraGanNhat: string | null;
  ngayKiemTraKeTiep: string | null;
  mucDoHoanThienHoSo: number; // %
  coViPham: boolean;
}

export type TrangThaiDieuKien = "Đã có" | "Chưa có" | "Không áp dụng";

export interface DieuKienPCCC {
  id: string;
  coSoId: string;
  ten: string;
  batBuoc: boolean;
  trangThai: TrangThaiDieuKien;
  ngayCapNhat: string;
  hanHieuLuc?: string | null;
  soFileDinhKem: number;
  ghiChu?: string;
}

export interface NhanSuCoSo {
  id: string;
  coSoId: string;
  hoTen: string;
  vaiTro: "Người đứng đầu" | "Đội trưởng đội PCCC cơ sở" | "Thành viên đội PCCC" | "Nhân viên phụ trách";
  dienThoai: string;
  trangThaiHuanLuyen: "Còn hạn" | "Sắp hết hạn" | "Hết hạn" | "Chưa huấn luyện";
  hanChungNhan: string | null;
}

export type LoaiViPham =
  | "Thiếu hồ sơ/phương án"
  | "Hệ thống báo cháy không hoạt động"
  | "Lối thoát nạn bị chặn"
  | "Thiết bị chữa cháy không đảm bảo"
  | "Hoạt động không phép"
  | "Không huấn luyện nghiệp vụ";

export type TrangThaiViPham =
  | "Mới ghi nhận"
  | "Đang khắc phục"
  | "Chờ duyệt"
  | "Đã hoàn thành"
  | "Trả lại";

export interface ViPham {
  id: string;
  ma: string;
  coSoId: string;
  loai: LoaiViPham;
  mucDo: "Nhẹ" | "Trung bình" | "Nghiêm trọng";
  ngayPhatHien: string;
  soQuyetDinh: string | null;
  trangThai: TrangThaiViPham;
  dinhChi: boolean;
  hanKhacPhuc: string | null;
  tienDoKhacPhuc: number; // %
  canBoTheoDoiId: string;
  soTaiLieu: number;
}

export type TrangThaiKiemTra =
  | "Lên kế hoạch"
  | "Đã thông báo"
  | "Đã dời lịch"
  | "Chờ biên bản"
  | "Hoàn thành";

export interface CuocKiemTra {
  id: string;
  ma: string;
  coSoId: string;
  loai: "Định kỳ" | "Đột xuất" | "Chuyên đề";
  ngayKiemTra: string;
  ngayGoc?: string | null;
  lyDoDoiLich?: string | null;
  truongDoanId: string;
  trangThai: TrangThaiKiemTra;
  ketQua: "Đạt" | "Đạt có điều kiện" | "Không đạt" | null;
  soBienBan: string | null;
  soTonTai: number;
}

export interface KeHoachKiemTra {
  id: string;
  nam: number;
  canBoId: string;
  chiTieuNam: number;
  daThucHien: number;
  dotXuat: number;
  noChiTieu: number;
  thang: number;
  chiTieuThang: number;
  thucHienThang: number;
}

export type LoaiCongViec = "Thường xuyên" | "Đột xuất" | "Được giao";
export type TrangThaiCongViec = "Mới giao" | "Đang thực hiện" | "Chờ duyệt" | "Hoàn thành" | "Quá hạn";

export interface CongViec {
  id: string;
  ma: string;
  tieuDe: string;
  loai: LoaiCongViec;
  nguoiGiaoId: string;
  nguoiThucHienId: string;
  ngayGiao: string;
  hanHoanThanh: string;
  trangThai: TrangThaiCongViec;
  tienDo: number;
  canGiaiTrinh: boolean;
  moTa: string;
}

export interface GiaiTrinh {
  id: string;
  congViecId: string;
  nguoiYeuCauId: string;
  nguoiGiaiTrinhId: string;
  ngayYeuCau: string;
  noiDungYeuCau: string;
  noiDungPhanHoi: string | null;
  trangThai: "Chờ giải trình" | "Đã phản hồi" | "Đã chấp nhận" | "Không chấp nhận";
}

export type ChuKyBaoCao = "Tuần" | "Tháng" | "Quý" | "Năm" | "Đột xuất";
export type TrangThaiBaoCao = "Chưa làm" | "Đang soạn" | "Đã nộp" | "Nộp trễ" | "Quá hạn";

export interface BaoCao {
  id: string;
  ma: string;
  ten: string;
  chuKy: ChuKyBaoCao;
  noiNhan: string;
  soVanBanYeuCau: string | null;
  hanNop: string;
  ngayNop: string | null;
  nguoiPhuTrachId: string;
  trangThai: TrangThaiBaoCao;
  soNgayCanhBao: number;
  coBieuMau: boolean;
}

export type LoaiSuCo = "Cháy" | "Nổ" | "Cứu nạn cứu hộ" | "Hỗ trợ y tế" | "Sự cố khác";

export interface SuCo {
  id: string;
  ma: string;
  loai: LoaiSuCo;
  thoiDiem: string; // ISO datetime
  diaChi: string;
  phuongId: string;
  coSoId: string | null;
  nguyenNhan: string;
  soNguoiChet: number;
  soNguoiBiThuong: number;
  thietHaiTaiSan: number; // triệu đồng
  dienTichChay: number; // m2
  canBoXuLyId: string;
  hanXuLy: string;
  trangThai: "Mới tiếp nhận" | "Đang xử lý hồ sơ" | "Hoàn thành" | "Quá hạn";
}

export type LoaiVanBan =
  | "Luật"
  | "Nghị định"
  | "Thông tư"
  | "Quy chuẩn/Tiêu chuẩn"
  | "Công văn chỉ đạo"
  | "Hướng dẫn nghiệp vụ";

export interface VanBanPhapLuat {
  id: string;
  soKyHieu: string;
  trichYeu: string;
  loai: LoaiVanBan;
  coQuanBanHanh: string;
  ngayBanHanh: string;
  ngayHieuLuc: string;
  conHieuLuc: boolean;
  fileUrl: string;
}

export interface TaiKhoan {
  id: string;
  tenDangNhap: string;
  canBoId: string;
  vaiTro: ActorCode;
  phamViDuLieu: string;
  lanDangNhapCuoi: string | null;
  trangThai: "Hoạt động" | "Khóa" | "Ngưng";
}

export interface NhatKy {
  id: string;
  thoiDiem: string;
  nguoiDungId: string;
  hanhDong: string;
  doiTuong: string;
  truocDo: string | null;
  sauDo: string | null;
  diaChiIp: string;
}

export type LoaiCanhBao =
  | "Hạn kiểm tra"
  | "Hạn báo cáo"
  | "Chứng nhận hết hạn"
  | "Vi phạm quá hạn khắc phục"
  | "Công việc quá hạn"
  | "Sự cố cần xử lý";

export interface CanhBao {
  id: string;
  loai: LoaiCanhBao;
  tieuDe: string;
  moTa: string;
  mucDo: "Cao" | "Trung bình" | "Thấp";
  thoiDiem: string;
  daDoc: boolean;
  duongDan: string;
}
