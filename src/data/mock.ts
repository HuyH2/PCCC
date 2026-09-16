/**
 * Dữ liệu mẫu cho bản demo/MVP.
 *
 * Theo NFR-02 và BR-12 của URD: môi trường demo CHỈ dùng dữ liệu mẫu.
 * Toàn bộ số liệu dưới đây là hư cấu, sinh bằng bộ số ngẫu nhiên có hạt giống
 * cố định để server và client render ra cùng một kết quả.
 */
import type {
  BaoCao, CanBo, CanhBao, CoSo, CongViec, CuocKiemTra, DieuKienPCCC, DonVi,
  GiaiTrinh, KeHoachKiemTra, KhuVuc, LoaiHinhCoSo, LoaiSuCo, LoaiViPham,
  NhanSuCoSo, NhatKy, SuCo, TaiKhoan, TrangThaiCoSo, VanBanPhapLuat, ViPham,
} from "./types";

/* ---------- Bộ sinh số giả ngẫu nhiên có hạt giống (deterministic) -------- */
function taoRandom(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}
const rnd = taoRandom(20260909);
const chon = <T,>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)];
const soTu = (min: number, max: number) => Math.floor(rnd() * (max - min + 1)) + min;

/** Ngày mốc của hệ thống demo — đồng bộ với ngày lập URD */
export const NGAY_HE_THONG = new Date("2026-09-16T00:00:00");

function ngayLech(soNgay: number) {
  const d = new Date(NGAY_HE_THONG);
  d.setDate(d.getDate() + soNgay);
  return d.toISOString().slice(0, 10);
}
function gioLech(soNgay: number, gio: number, phut: number) {
  const d = new Date(NGAY_HE_THONG);
  d.setDate(d.getDate() + soNgay);
  d.setHours(gio, phut, 0, 0);
  return d.toISOString();
}

/* ------------------------------ Đơn vị (M02) ----------------------------- */
export const donViList: DonVi[] = [
  { id: "DV01", ma: "PC07", ten: "Phòng Cảnh sát PCCC & CNCH (PC07)", cap: "Tỉnh/Thành phố", donViChaId: null, nguoiPhuTrachId: "CB001", trangThai: "Hoạt động", soCoSo: 2048 },
  { id: "DV02", ma: "KV10", ten: "Đội Cảnh sát PCCC & CNCH Khu vực 10", cap: "Khu vực", donViChaId: "DV01", nguoiPhuTrachId: "CB002", trangThai: "Hoạt động", soCoSo: 2048 },
  { id: "DV03", ma: "PHV", ten: "Phường Hòa Hưng", cap: "Phường", donViChaId: "DV02", nguoiPhuTrachId: "CB004", trangThai: "Hoạt động", soCoSo: 786 },
  { id: "DV04", ma: "PDH", ten: "Phường Diên Hồng", cap: "Phường", donViChaId: "DV02", nguoiPhuTrachId: "CB005", trangThai: "Hoạt động", soCoSo: 642 },
  { id: "DV05", ma: "PVL", ten: "Phường Vườn Lài", cap: "Phường", donViChaId: "DV02", nguoiPhuTrachId: "CB006", trangThai: "Hoạt động", soCoSo: 620 },
];

/* ------------------------------ Cán bộ (M02) ----------------------------- */
export const canBoList: CanBo[] = [
  { id: "CB001", ma: "PC07-001", hoTen: "Nguyễn Văn Danh", capBac: "Thượng tá", chucVu: "Trưởng phòng PC07", dienThoai: "0903 112 007", email: "danh.nv@pc07.gov.vn", donViId: "DV01", vaiTro: "A06", trangThai: "Đang công tác" },
  { id: "CB002", ma: "KV10-001", hoTen: "Trần Quốc Hùng", capBac: "Trung tá", chucVu: "Đội trưởng Kv10", dienThoai: "0903 445 110", email: "hung.tq@pc07.gov.vn", donViId: "DV02", vaiTro: "A01", trangThai: "Đang công tác" },
  { id: "CB003", ma: "KV10-002", hoTen: "Lê Minh Tuấn", capBac: "Thiếu tá", chucVu: "Phó Đội trưởng Kv10", dienThoai: "0908 221 336", email: "tuan.lm@pc07.gov.vn", donViId: "DV02", vaiTro: "A02", trangThai: "Đang công tác" },
  { id: "CB004", ma: "KV10-003", hoTen: "Phạm Thị Hồng Nhung", capBac: "Đại úy", chucVu: "Cán bộ quản lý địa bàn", dienThoai: "0912 556 778", email: "nhung.pth@pc07.gov.vn", donViId: "DV02", vaiTro: "A03", trangThai: "Đang công tác" },
  { id: "CB005", ma: "KV10-004", hoTen: "Võ Thành Long", capBac: "Đại úy", chucVu: "Cán bộ kiểm tra", dienThoai: "0938 114 229", email: "long.vt@pc07.gov.vn", donViId: "DV02", vaiTro: "A03", trangThai: "Đang công tác" },
  { id: "CB006", ma: "KV10-005", hoTen: "Đặng Hoài Nam", capBac: "Thượng úy", chucVu: "Cán bộ kiểm tra", dienThoai: "0977 332 118", email: "nam.dh@pc07.gov.vn", donViId: "DV02", vaiTro: "A03", trangThai: "Đang công tác" },
  { id: "CB007", ma: "KV10-006", hoTen: "Bùi Thị Lan Anh", capBac: "Thượng úy", chucVu: "Cán bộ tổng hợp", dienThoai: "0909 887 443", email: "anh.btl@pc07.gov.vn", donViId: "DV02", vaiTro: "A04", trangThai: "Đang công tác" },
  { id: "CB008", ma: "KV10-007", hoTen: "Ngô Đức Thắng", capBac: "Trung úy", chucVu: "Cán bộ quản lý địa bàn", dienThoai: "0932 664 001", email: "thang.nd@pc07.gov.vn", donViId: "DV02", vaiTro: "A03", trangThai: "Đang công tác" },
  { id: "CB009", ma: "KV10-008", hoTen: "Hoàng Minh Khôi", capBac: "Trung úy", chucVu: "Cán bộ kiểm tra", dienThoai: "0918 223 557", email: "khoi.hm@pc07.gov.vn", donViId: "DV02", vaiTro: "A03", trangThai: "Nghỉ phép" },
  { id: "CB010", ma: "KV10-009", hoTen: "Trịnh Văn Sơn", capBac: "Thiếu úy", chucVu: "Cán bộ quản lý địa bàn", dienThoai: "0945 778 112", email: "son.tv@pc07.gov.vn", donViId: "DV02", vaiTro: "A03", trangThai: "Đang công tác" },
  { id: "CB011", ma: "KV10-010", hoTen: "Đỗ Thu Trang", capBac: "Thiếu úy", chucVu: "Quản trị hệ thống", dienThoai: "0966 445 223", email: "trang.dt@pc07.gov.vn", donViId: "DV02", vaiTro: "A05", trangThai: "Đang công tác" },
];

export const canBoTheoId = new Map(canBoList.map((c) => [c.id, c]));
export const donViTheoId = new Map(donViList.map((d) => [d.id, d]));

/** Cán bộ trực tiếp quản lý địa bàn — dùng cho phân công và KPI */
export const canBoDiaBan = canBoList.filter((c) => c.vaiTro === "A03");

/* --------------------------- Khu vực/Khu phố (M02) ----------------------- */
const tenKhuPho: Record<string, string[]> = {
  DV03: ["Khu phố 1 - Hòa Hưng", "Khu phố 2 - Hòa Hưng", "Khu phố 3 - Hòa Hưng", "Khu phố 4 - Hòa Hưng", "Khu phố 5 - Hòa Hưng"],
  DV04: ["Khu phố 1 - Diên Hồng", "Khu phố 2 - Diên Hồng", "Khu phố 3 - Diên Hồng", "Khu phố 4 - Diên Hồng"],
  DV05: ["Khu phố 1 - Vườn Lài", "Khu phố 2 - Vườn Lài", "Khu phố 3 - Vườn Lài", "Khu phố 4 - Vườn Lài"],
};

export const khuVucList: KhuVuc[] = Object.entries(tenKhuPho).flatMap(([phuongId, dsTen]) =>
  dsTen.map((ten, i) => ({
    id: `KV-${phuongId}-${i + 1}`,
    ma: `${donViTheoId.get(phuongId)!.ma}-KP${String(i + 1).padStart(2, "0")}`,
    ten,
    phuongId,
    canBoPhuTrachId: canBoDiaBan[(i + dsTen.length) % canBoDiaBan.length].id,
    soCoSo: 0,
  })),
);
export const khuVucTheoId = new Map(khuVucList.map((k) => [k.id, k]));

/* -------------------------------- Cơ sở (M03) ---------------------------- */
const loaiHinhList: LoaiHinhCoSo[] = [
  "Chung cư/Nhà cao tầng", "Chợ/Trung tâm thương mại", "Cơ sở giáo dục", "Cơ sở y tế",
  "Khách sạn/Nhà nghỉ", "Karaoke/Vũ trường", "Nhà xưởng/Kho", "Trạm xăng dầu",
  "Văn phòng/Trụ sở", "Nhà ở kết hợp kinh doanh",
];
const tienToTen: Record<LoaiHinhCoSo, string[]> = {
  "Chung cư/Nhà cao tầng": ["Chung cư Hoa Sen", "Cao ốc Bình Minh", "Chung cư An Phú", "Toà nhà Sky View"],
  "Chợ/Trung tâm thương mại": ["Chợ Hòa Hưng", "TTTM Vườn Lài Plaza", "Chợ Diên Hồng", "Siêu thị Tân Phát"],
  "Cơ sở giáo dục": ["Trường THCS Lê Lợi", "Trường Tiểu học Kim Đồng", "Trường THPT Nguyễn Du", "Mầm non Hoa Mai"],
  "Cơ sở y tế": ["Phòng khám Đa khoa Việt Mỹ", "Trạm Y tế Hòa Hưng", "Bệnh viện Quốc tế Sài Gòn", "Nha khoa Ngọc Lan"],
  "Khách sạn/Nhà nghỉ": ["Khách sạn Hoàng Gia", "Nhà nghỉ Thanh Bình", "Khách sạn Đông Đô", "Hotel Ngọc Việt"],
  "Karaoke/Vũ trường": ["Karaoke Hoàng Tử", "Karaoke Sunny", "Bar Night Sky", "Karaoke Ngọc Bích"],
  "Nhà xưởng/Kho": ["Kho Tân Hưng", "Xưởng may Thành Đạt", "Kho lạnh Phú Cường", "Xưởng gỗ Minh Long"],
  "Trạm xăng dầu": ["CHXD Petrolimex 27", "CHXD Comeco 14", "CHXD PVOil 09", "CHXD Sài Gòn 33"],
  "Văn phòng/Trụ sở": ["Văn phòng Công ty Đại Việt", "Trụ sở Ngân hàng Á Châu", "VP Công ty Tân Tiến", "Trụ sở Bưu điện KV10"],
  "Nhà ở kết hợp kinh doanh": ["Hộ KD Nguyễn Thị Bảy", "Hộ KD Trần Văn Tám", "Hộ KD Lê Thị Chín", "Hộ KD Phạm Văn Bốn"],
};
const tenDuong = ["Cách Mạng Tháng 8", "Tô Hiến Thành", "Lý Thái Tổ", "Nguyễn Thượng Hiền", "Bà Hạt", "Vườn Lài", "Thành Thái", "Sư Vạn Hạnh", "Hòa Hưng", "Nguyễn Tri Phương"];
const hoTenNguoiDungDau = ["Nguyễn Văn An", "Trần Thị Bình", "Lê Hoàng Cường", "Phạm Thị Dung", "Hoàng Văn Em", "Vũ Thị Giang", "Đặng Minh Hải", "Bùi Thị Hoa", "Ngô Văn Khánh", "Đỗ Thị Lan"];

const trangThaiCoSoPhanBo: TrangThaiCoSo[] = [
  ...Array<TrangThaiCoSo>(82).fill("Đang hoạt động"),
  ...Array<TrangThaiCoSo>(7).fill("Đang đình chỉ"),
  ...Array<TrangThaiCoSo>(6).fill("Tạm ngừng"),
  ...Array<TrangThaiCoSo>(5).fill("Không phép"),
];

function taoCoSo(index: number): CoSo {
  const khuVuc = khuVucList[index % khuVucList.length];
  const loaiHinh = chon(loaiHinhList);
  const ten = `${chon(tienToTen[loaiHinh])} ${soTu(1, 9)}`;
  const trangThai = chon(trangThaiCoSoPhanBo);
  const lanKiemTra = soTu(-210, -8);
  return {
    id: `CS${String(index + 1).padStart(4, "0")}`,
    ma: `KV10-CS-${String(index + 1).padStart(4, "0")}`,
    ten,
    diaChi: `${soTu(1, 480)} ${chon(tenDuong)}, ${donViTheoId.get(khuVuc.phuongId)!.ten}`,
    loaiHinh,
    khuVucId: khuVuc.id,
    phuongId: khuVuc.phuongId,
    canBoPhuTrachId: khuVuc.canBoPhuTrachId!,
    trangThai,
    nguoiDungDau: chon(hoTenNguoiDungDau),
    dienThoai: `09${soTu(10, 89)} ${soTu(100, 999)} ${soTu(100, 999)}`,
    soTang: soTu(1, 22),
    dienTich: soTu(60, 9000),
    ngayKiemTraGanNhat: ngayLech(lanKiemTra),
    ngayKiemTraKeTiep: ngayLech(lanKiemTra + soTu(180, 400)),
    mucDoHoanThienHoSo: soTu(35, 100),
    coViPham: trangThai !== "Đang hoạt động" || rnd() < 0.12,
  };
}

/** 420 cơ sở mẫu — quy mô thật của Kv10 khoảng 2.000 cơ sở (NFR-06) */
export const coSoList: CoSo[] = Array.from({ length: 420 }, (_, i) => taoCoSo(i));
export const coSoTheoId = new Map(coSoList.map((c) => [c.id, c]));

// Cập nhật số cơ sở thực tế cho từng khu phố
for (const kv of khuVucList) {
  kv.soCoSo = coSoList.filter((c) => c.khuVucId === kv.id).length;
}

/* ---------------------- Điều kiện/hồ sơ PCCC của cơ sở ------------------- */
const danhMucDieuKien: { ten: string; batBuoc: boolean }[] = [
  { ten: "Hồ sơ thẩm duyệt thiết kế về PCCC", batBuoc: true },
  { ten: "Văn bản nghiệm thu về PCCC", batBuoc: true },
  { ten: "Phương án chữa cháy của cơ sở", batBuoc: true },
  { ten: "Nội quy, tiêu lệnh, biển cấm lửa", batBuoc: true },
  { ten: "Quyết định thành lập đội PCCC cơ sở", batBuoc: true },
  { ten: "Chứng nhận huấn luyện nghiệp vụ PCCC", batBuoc: true },
  { ten: "Hệ thống báo cháy tự động", batBuoc: false },
  { ten: "Hệ thống chữa cháy tự động (Sprinkler)", batBuoc: false },
  { ten: "Hệ thống họng nước chữa cháy trong nhà", batBuoc: true },
  { ten: "Bình chữa cháy xách tay", batBuoc: true },
  { ten: "Đèn chiếu sáng sự cố, chỉ dẫn thoát nạn", batBuoc: true },
  { ten: "Hồ sơ bảo hiểm cháy nổ bắt buộc", batBuoc: false },
];

export function dieuKienCuaCoSo(coSoId: string): DieuKienPCCC[] {
  const r = taoRandom(Number(coSoId.replace(/\D/g, "")) * 7919 + 13);
  return danhMucDieuKien.map((dk, i) => {
    const p = r();
    const trangThai = p < 0.62 ? "Đã có" : p < 0.88 ? "Chưa có" : "Không áp dụng";
    return {
      id: `${coSoId}-DK${i + 1}`,
      coSoId,
      ten: dk.ten,
      batBuoc: dk.batBuoc,
      trangThai,
      ngayCapNhat: ngayLech(-Math.floor(r() * 300) - 5),
      hanHieuLuc: trangThai === "Đã có" && r() < 0.5 ? ngayLech(Math.floor(r() * 500) - 90) : null,
      soFileDinhKem: trangThai === "Đã có" ? Math.floor(r() * 4) : 0,
      ghiChu: trangThai === "Chưa có" && dk.batBuoc ? "Cần bổ sung trước kỳ kiểm tra kế tiếp" : undefined,
    };
  });
}

export function nhanSuCuaCoSo(coSo: CoSo): NhanSuCoSo[] {
  const r = taoRandom(Number(coSo.id.replace(/\D/g, "")) * 104729 + 7);
  const vaiTroList: NhanSuCoSo["vaiTro"][] = ["Người đứng đầu", "Đội trưởng đội PCCC cơ sở", "Thành viên đội PCCC", "Nhân viên phụ trách"];
  const trangThaiList: NhanSuCoSo["trangThaiHuanLuyen"][] = ["Còn hạn", "Sắp hết hạn", "Hết hạn", "Chưa huấn luyện"];
  return Array.from({ length: 4 }, (_, i) => {
    const tt = i === 0 ? "Còn hạn" : trangThaiList[Math.floor(r() * trangThaiList.length)];
    return {
      id: `${coSo.id}-NS${i + 1}`,
      coSoId: coSo.id,
      hoTen: i === 0 ? coSo.nguoiDungDau : hoTenNguoiDungDau[Math.floor(r() * hoTenNguoiDungDau.length)],
      vaiTro: vaiTroList[i],
      dienThoai: `09${Math.floor(r() * 80) + 10} ${Math.floor(r() * 900) + 100} ${Math.floor(r() * 900) + 100}`,
      trangThaiHuanLuyen: tt,
      hanChungNhan: tt === "Chưa huấn luyện" ? null : ngayLech(Math.floor(r() * 700) - 200),
    };
  });
}

/* ------------------------- Vi phạm/Đình chỉ (M04) ------------------------ */
const loaiViPhamList: LoaiViPham[] = [
  "Thiếu hồ sơ/phương án", "Hệ thống báo cháy không hoạt động", "Lối thoát nạn bị chặn",
  "Thiết bị chữa cháy không đảm bảo", "Hoạt động không phép", "Không huấn luyện nghiệp vụ",
];

export const viPhamList: ViPham[] = coSoList
  .filter((c) => c.coViPham)
  .slice(0, 96)
  .map((cs, i) => {
    const dinhChi = cs.trangThai === "Đang đình chỉ";
    const trangThai = dinhChi
      ? chon(["Đang khắc phục", "Chờ duyệt"] as const)
      : chon(["Mới ghi nhận", "Đang khắc phục", "Chờ duyệt", "Đã hoàn thành", "Trả lại"] as const);
    return {
      id: `VP${String(i + 1).padStart(3, "0")}`,
      ma: `VP-2026-${String(i + 1).padStart(3, "0")}`,
      coSoId: cs.id,
      loai: cs.trangThai === "Không phép" ? "Hoạt động không phép" : chon(loaiViPhamList),
      mucDo: dinhChi ? "Nghiêm trọng" : chon(["Nhẹ", "Trung bình", "Nghiêm trọng"] as const),
      ngayPhatHien: ngayLech(-soTu(10, 260)),
      soQuyetDinh: dinhChi ? `${soTu(100, 999)}/QĐ-PC07` : rnd() < 0.5 ? `${soTu(100, 999)}/QĐ-PC07` : null,
      trangThai,
      dinhChi,
      hanKhacPhuc: trangThai === "Đã hoàn thành" ? null : ngayLech(soTu(-40, 75)),
      tienDoKhacPhuc: trangThai === "Đã hoàn thành" ? 100 : soTu(0, 90),
      canBoTheoDoiId: cs.canBoPhuTrachId,
      soTaiLieu: soTu(0, 6),
    };
  });

/* --------------------------- Kiểm tra (M06) ------------------------------ */
export const cuocKiemTraList: CuocKiemTra[] = coSoList.slice(0, 140).map((cs, i) => {
  const ngayLechNgay = soTu(-120, 45);
  const daQua = ngayLechNgay < 0;
  const doiLich = rnd() < 0.12;
  const trangThai = daQua
    ? chon(["Chờ biên bản", "Hoàn thành", "Hoàn thành"] as const)
    : doiLich
      ? "Đã dời lịch"
      : chon(["Lên kế hoạch", "Đã thông báo"] as const);
  const hoanThanh = trangThai === "Hoàn thành";
  return {
    id: `KT${String(i + 1).padStart(3, "0")}`,
    ma: `KT-2026-${String(i + 1).padStart(3, "0")}`,
    coSoId: cs.id,
    loai: chon(["Định kỳ", "Định kỳ", "Định kỳ", "Đột xuất", "Chuyên đề"] as const),
    ngayKiemTra: ngayLech(ngayLechNgay),
    ngayGoc: doiLich ? ngayLech(ngayLechNgay - soTu(3, 14)) : null,
    lyDoDoiLich: doiLich ? chon(["Cơ sở đề nghị dời do đang sửa chữa", "Trùng lịch công tác đột xuất", "Người đứng đầu đi công tác"]) : null,
    truongDoanId: chon(canBoDiaBan).id,
    trangThai,
    ketQua: hoanThanh ? chon(["Đạt", "Đạt có điều kiện", "Không đạt"] as const) : null,
    soBienBan: hoanThanh ? `${soTu(10, 499)}/BB-KT` : null,
    soTonTai: hoanThanh ? soTu(0, 7) : 0,
  };
});

/* ---------------------- Kế hoạch kiểm tra & KPI (M06/M07) ---------------- */
export const keHoachKiemTraList: KeHoachKiemTra[] = canBoDiaBan.map((cb, i) => {
  const chiTieuNam = soTu(180, 260);
  const daThucHien = soTu(90, chiTieuNam);
  const chiTieuThang = Math.round(chiTieuNam / 12);
  const thucHienThang = soTu(Math.max(0, chiTieuThang - 8), chiTieuThang + 4);
  return {
    id: `KH2026-${i + 1}`,
    nam: 2026,
    canBoId: cb.id,
    chiTieuNam,
    daThucHien,
    dotXuat: soTu(4, 26),
    noChiTieu: Math.max(0, Math.round((chiTieuNam * 9) / 12) - daThucHien),
    thang: 9,
    chiTieuThang,
    thucHienThang,
  };
});

/* ------------------------- Công việc & giải trình (M07) ------------------ */
const tieuDeCongViec = [
  "Kiểm tra định kỳ cụm cơ sở khu phố",
  "Tổng hợp số liệu cơ sở tồn tại vi phạm",
  "Rà soát hồ sơ phương án chữa cháy",
  "Tuyên truyền PCCC tại khu dân cư",
  "Cập nhật danh sách cơ sở không phép",
  "Hoàn thiện biên bản kiểm tra tồn đọng",
  "Kiểm tra đột xuất cơ sở karaoke",
  "Thống kê thiệt hại vụ cháy trong tháng",
  "Bổ sung hồ sơ scan lên hệ thống",
  "Phúc tra kết quả khắc phục vi phạm",
];

export const congViecList: CongViec[] = Array.from({ length: 48 }, (_, i) => {
  const hanLech = soTu(-25, 30);
  const loai = chon(["Thường xuyên", "Đột xuất", "Được giao"] as const);
  const quaHan = hanLech < 0 && rnd() < 0.55;
  const trangThai = quaHan
    ? "Quá hạn"
    : hanLech < 0
      ? "Hoàn thành"
      : chon(["Mới giao", "Đang thực hiện", "Chờ duyệt"] as const);
  return {
    id: `CV${String(i + 1).padStart(3, "0")}`,
    ma: `CV-2026-${String(i + 1).padStart(3, "0")}`,
    tieuDe: `${chon(tieuDeCongViec)} ${chon(khuVucList).ten.split(" - ")[0]}`,
    loai,
    nguoiGiaoId: chon(["CB002", "CB003"]),
    nguoiThucHienId: chon(canBoDiaBan).id,
    ngayGiao: ngayLech(hanLech - soTu(5, 20)),
    hanHoanThanh: ngayLech(hanLech),
    trangThai,
    tienDo: trangThai === "Hoàn thành" ? 100 : trangThai === "Mới giao" ? 0 : soTu(10, 85),
    canGiaiTrinh: trangThai === "Quá hạn" && rnd() < 0.6,
    moTa: "Nội dung công việc theo chỉ đạo của chỉ huy đội, có sản phẩm bàn giao kèm tài liệu chứng minh.",
  };
});

export const giaiTrinhList: GiaiTrinh[] = congViecList
  .filter((cv) => cv.canGiaiTrinh)
  .map((cv, i) => {
    const trangThai = chon(["Chờ giải trình", "Đã phản hồi", "Đã chấp nhận", "Không chấp nhận"] as const);
    return {
      id: `GT${String(i + 1).padStart(3, "0")}`,
      congViecId: cv.id,
      nguoiYeuCauId: cv.nguoiGiaoId,
      nguoiGiaiTrinhId: cv.nguoiThucHienId,
      ngayYeuCau: ngayLech(-soTu(1, 20)),
      noiDungYeuCau: "Đề nghị giải trình lý do chậm tiến độ và cam kết mốc hoàn thành mới.",
      noiDungPhanHoi:
        trangThai === "Chờ giải trình"
          ? null
          : "Do phát sinh kiểm tra đột xuất theo chỉ đạo, đề nghị gia hạn thêm 07 ngày làm việc.",
      trangThai,
    };
  });

/* -------------------------- Báo cáo & deadline (M08) --------------------- */
const danhMucBaoCao: { ten: string; chuKy: BaoCao["chuKy"]; noiNhan: string }[] = [
  { ten: "Báo cáo công tác PCCC & CNCH tuần", chuKy: "Tuần", noiNhan: "PC07 - Phòng tham mưu" },
  { ten: "Báo cáo kết quả kiểm tra an toàn PCCC tháng", chuKy: "Tháng", noiNhan: "PC07 - Đội Hướng dẫn kiểm tra" },
  { ten: "Báo cáo tình hình cháy nổ và CNCH tháng", chuKy: "Tháng", noiNhan: "Ban Giám đốc Công an TP" },
  { ten: "Báo cáo cơ sở đình chỉ, tạm đình chỉ", chuKy: "Tháng", noiNhan: "PC07 - Phòng tham mưu" },
  { ten: "Báo cáo chuyên đề cơ sở karaoke, vũ trường", chuKy: "Quý", noiNhan: "UBND Quận" },
  { ten: "Báo cáo tổng kết công tác PCCC năm", chuKy: "Năm", noiNhan: "PC07 - Ban chỉ huy" },
  { ten: "Báo cáo đột xuất theo Công văn 1123/PC07", chuKy: "Đột xuất", noiNhan: "PC07 - Phòng tham mưu" },
  { ten: "Báo cáo rà soát cơ sở nhà trọ, nhà ở kết hợp kinh doanh", chuKy: "Đột xuất", noiNhan: "UBND Phường" },
  { ten: "Báo cáo kết quả tuyên truyền, huấn luyện nghiệp vụ", chuKy: "Quý", noiNhan: "PC07 - Đội tuyên truyền" },
  { ten: "Báo cáo chất lượng dữ liệu hồ sơ cơ sở", chuKy: "Tháng", noiNhan: "Đội Kv10" },
];

export const baoCaoList: BaoCao[] = Array.from({ length: 26 }, (_, i) => {
  const mau = danhMucBaoCao[i % danhMucBaoCao.length];
  const hanLech = soTu(-18, 28);
  const daNop = hanLech < 0 ? rnd() < 0.72 : rnd() < 0.25;
  const nopTre = daNop && hanLech < 0 && rnd() < 0.3;
  return {
    id: `BC${String(i + 1).padStart(3, "0")}`,
    ma: `BC-2026-${String(i + 1).padStart(3, "0")}`,
    ten: mau.ten,
    chuKy: mau.chuKy,
    noiNhan: mau.noiNhan,
    soVanBanYeuCau: mau.chuKy === "Đột xuất" ? `${soTu(900, 1500)}/PC07-P1` : null,
    hanNop: ngayLech(hanLech),
    ngayNop: daNop ? ngayLech(hanLech + (nopTre ? soTu(1, 4) : -soTu(0, 3))) : null,
    nguoiPhuTrachId: chon(["CB007", ...canBoDiaBan.map((c) => c.id)]),
    trangThai: daNop ? (nopTre ? "Nộp trễ" : "Đã nộp") : hanLech < 0 ? "Quá hạn" : rnd() < 0.5 ? "Đang soạn" : "Chưa làm",
    soNgayCanhBao: chon([3, 5, 7]),
    coBieuMau: rnd() < 0.7,
  };
});

/* -------------------------------- Sự cố (M09) ---------------------------- */
const loaiSuCoList: LoaiSuCo[] = ["Cháy", "Cháy", "Cháy", "Nổ", "Cứu nạn cứu hộ", "Hỗ trợ y tế", "Sự cố khác"];
const nguyenNhanList = [
  "Sự cố hệ thống điện", "Sơ suất trong sử dụng lửa, nhiệt", "Rò rỉ khí gas",
  "Chập cháy thiết bị điện tử", "Đốt do mâu thuẫn cá nhân", "Đang điều tra làm rõ",
];

export const suCoList: SuCo[] = Array.from({ length: 64 }, (_, i) => {
  const lech = -soTu(1, 300);
  const loai = chon(loaiSuCoList);
  const hanLech = lech + soTu(10, 30);
  const coSo = rnd() < 0.55 ? chon(coSoList) : null;
  return {
    id: `SC${String(i + 1).padStart(3, "0")}`,
    ma: `SC-2026-${String(i + 1).padStart(3, "0")}`,
    loai,
    thoiDiem: gioLech(lech, soTu(0, 23), soTu(0, 59)),
    diaChi: coSo ? coSo.diaChi : `${soTu(1, 400)} ${chon(tenDuong)}, ${chon(donViList.slice(2)).ten}`,
    phuongId: coSo ? coSo.phuongId : chon(donViList.slice(2)).id,
    coSoId: coSo?.id ?? null,
    nguyenNhan: chon(nguyenNhanList),
    soNguoiChet: loai === "Cháy" && rnd() < 0.06 ? soTu(1, 2) : 0,
    soNguoiBiThuong: rnd() < 0.22 ? soTu(1, 4) : 0,
    thietHaiTaiSan: loai === "Cháy" || loai === "Nổ" ? soTu(0, 850) / 10 : 0,
    dienTichChay: loai === "Cháy" ? soTu(2, 400) : 0,
    canBoXuLyId: chon(canBoList.filter((c) => c.vaiTro === "A03" || c.vaiTro === "A04")).id,
    hanXuLy: ngayLech(hanLech),
    trangThai: hanLech < 0 ? (rnd() < 0.82 ? "Hoàn thành" : "Quá hạn") : chon(["Mới tiếp nhận", "Đang xử lý hồ sơ"] as const),
  };
});

/* --------------------- Văn bản pháp luật/quy chuẩn (M05) ----------------- */
export const vanBanList: VanBanPhapLuat[] = [
  { id: "VB01", soKyHieu: "27/2001/QH10", trichYeu: "Luật Phòng cháy và chữa cháy", loai: "Luật", coQuanBanHanh: "Quốc hội", ngayBanHanh: "2001-06-29", ngayHieuLuc: "2001-10-04", conHieuLuc: true, fileUrl: "#" },
  { id: "VB02", soKyHieu: "40/2013/QH13", trichYeu: "Luật sửa đổi, bổ sung một số điều của Luật PCCC", loai: "Luật", coQuanBanHanh: "Quốc hội", ngayBanHanh: "2013-11-22", ngayHieuLuc: "2014-07-01", conHieuLuc: true, fileUrl: "#" },
  { id: "VB03", soKyHieu: "136/2020/NĐ-CP", trichYeu: "Quy định chi tiết một số điều và biện pháp thi hành Luật PCCC và CNCH", loai: "Nghị định", coQuanBanHanh: "Chính phủ", ngayBanHanh: "2020-11-24", ngayHieuLuc: "2021-01-10", conHieuLuc: true, fileUrl: "#" },
  { id: "VB04", soKyHieu: "50/2024/NĐ-CP", trichYeu: "Sửa đổi, bổ sung Nghị định 136/2020/NĐ-CP và Nghị định 83/2017/NĐ-CP", loai: "Nghị định", coQuanBanHanh: "Chính phủ", ngayBanHanh: "2024-05-10", ngayHieuLuc: "2024-05-15", conHieuLuc: true, fileUrl: "#" },
  { id: "VB05", soKyHieu: "149/2020/TT-BCA", trichYeu: "Quy định chi tiết một số điều của Luật PCCC và Nghị định 136/2020/NĐ-CP", loai: "Thông tư", coQuanBanHanh: "Bộ Công an", ngayBanHanh: "2020-12-31", ngayHieuLuc: "2021-02-20", conHieuLuc: true, fileUrl: "#" },
  { id: "VB06", soKyHieu: "QCVN 06:2022/BXD", trichYeu: "Quy chuẩn kỹ thuật quốc gia về An toàn cháy cho nhà và công trình", loai: "Quy chuẩn/Tiêu chuẩn", coQuanBanHanh: "Bộ Xây dựng", ngayBanHanh: "2022-11-30", ngayHieuLuc: "2023-01-16", conHieuLuc: true, fileUrl: "#" },
  { id: "VB07", soKyHieu: "TCVN 3890:2023", trichYeu: "Phương tiện PCCC cho nhà và công trình - Trang bị, bố trí", loai: "Quy chuẩn/Tiêu chuẩn", coQuanBanHanh: "Bộ KH&CN", ngayBanHanh: "2023-03-15", ngayHieuLuc: "2023-07-01", conHieuLuc: true, fileUrl: "#" },
  { id: "VB08", soKyHieu: "QCVN 03:2021/BCA", trichYeu: "Quy chuẩn kỹ thuật quốc gia về phương tiện PCCC", loai: "Quy chuẩn/Tiêu chuẩn", coQuanBanHanh: "Bộ Công an", ngayBanHanh: "2021-09-30", ngayHieuLuc: "2022-04-01", conHieuLuc: true, fileUrl: "#" },
  { id: "VB09", soKyHieu: "1123/PC07-P1", trichYeu: "V/v tăng cường kiểm tra an toàn PCCC đối với cơ sở karaoke, vũ trường", loai: "Công văn chỉ đạo", coQuanBanHanh: "PC07", ngayBanHanh: "2026-06-12", ngayHieuLuc: "2026-06-12", conHieuLuc: true, fileUrl: "#" },
  { id: "VB10", soKyHieu: "0745/PC07-P1", trichYeu: "Hướng dẫn lập hồ sơ quản lý cơ sở thuộc diện quản lý về PCCC", loai: "Hướng dẫn nghiệp vụ", coQuanBanHanh: "PC07", ngayBanHanh: "2026-02-28", ngayHieuLuc: "2026-02-28", conHieuLuc: true, fileUrl: "#" },
  { id: "VB11", soKyHieu: "79/2014/NĐ-CP", trichYeu: "Quy định chi tiết thi hành một số điều của Luật PCCC (hết hiệu lực)", loai: "Nghị định", coQuanBanHanh: "Chính phủ", ngayBanHanh: "2014-07-31", ngayHieuLuc: "2014-09-15", conHieuLuc: false, fileUrl: "#" },
  { id: "VB12", soKyHieu: "0312/PC07-P4", trichYeu: "Checklist kiểm tra an toàn PCCC theo loại hình cơ sở", loai: "Hướng dẫn nghiệp vụ", coQuanBanHanh: "PC07", ngayBanHanh: "2026-01-20", ngayHieuLuc: "2026-01-20", conHieuLuc: true, fileUrl: "#" },
];

/* ------------------------ Tài khoản & nhật ký (M01) ---------------------- */
export const taiKhoanList: TaiKhoan[] = canBoList.map((cb, i) => ({
  id: `TK${String(i + 1).padStart(3, "0")}`,
  tenDangNhap: cb.email.split("@")[0],
  canBoId: cb.id,
  vaiTro: cb.vaiTro,
  phamViDuLieu:
    cb.vaiTro === "A05" || cb.vaiTro === "A06"
      ? "Toàn bộ Kv10"
      : cb.vaiTro === "A01" || cb.vaiTro === "A02"
        ? "Đội Kv10"
        : khuVucList.filter((k) => k.canBoPhuTrachId === cb.id).map((k) => k.ma).join(", ") || "Chưa phân công",
  lanDangNhapCuoi: gioLech(-soTu(0, 9), soTu(7, 18), soTu(0, 59)),
  trangThai: cb.trangThai === "Chuyển công tác" ? "Ngưng" : "Hoạt động",
}));

const hanhDongList = [
  "Đăng nhập hệ thống", "Tạo hồ sơ cơ sở", "Cập nhật hồ sơ cơ sở", "Phê duyệt hoạt động trở lại",
  "Import dữ liệu Excel", "Xuất báo cáo", "Cập nhật kết quả kiểm tra", "Phân công cán bộ phụ trách",
  "Tạo hồ sơ đình chỉ", "Cập nhật tiến độ khắc phục",
];

export const nhatKyList: NhatKy[] = Array.from({ length: 40 }, (_, i) => {
  const cb = chon(canBoList);
  const hanhDong = chon(hanhDongList);
  const coChuyenTrangThai = hanhDong.includes("Phê duyệt") || hanhDong.includes("kết quả");
  return {
    id: `LOG${String(i + 1).padStart(4, "0")}`,
    thoiDiem: gioLech(-soTu(0, 12), soTu(7, 19), soTu(0, 59)),
    nguoiDungId: cb.id,
    hanhDong,
    doiTuong: hanhDong.includes("cơ sở") ? chon(coSoList).ma : hanhDong.includes("kiểm tra") ? chon(cuocKiemTraList).ma : "Hệ thống",
    truocDo: coChuyenTrangThai ? "Đang đình chỉ" : null,
    sauDo: coChuyenTrangThai ? "Đang hoạt động" : null,
    diaChiIp: `10.20.${soTu(1, 12)}.${soTu(2, 254)}`,
  };
});

/* ------------------------------ Cảnh báo (M10) --------------------------- */
export const canhBaoList: CanhBao[] = [
  { id: "AL01", loai: "Hạn báo cáo", tieuDe: "3 báo cáo sắp đến hạn trong 5 ngày", moTa: "Báo cáo tuần và 2 báo cáo tháng gửi PC07 - Phòng tham mưu.", mucDo: "Cao", thoiDiem: gioLech(0, 7, 30), daDoc: false, duongDan: "/bao-cao/deadline" },
  { id: "AL02", loai: "Vi phạm quá hạn khắc phục", tieuDe: "7 cơ sở quá hạn khắc phục vi phạm", moTa: "Cần rà soát và tham mưu biện pháp xử lý tiếp theo.", mucDo: "Cao", thoiDiem: gioLech(0, 8, 5), daDoc: false, duongDan: "/vi-pham" },
  { id: "AL03", loai: "Chứng nhận hết hạn", tieuDe: "24 chứng nhận huấn luyện sắp hết hạn", moTa: "Thuộc 18 cơ sở trên địa bàn Kv10, hết hạn trong 30 ngày tới.", mucDo: "Trung bình", thoiDiem: gioLech(-1, 16, 20), daDoc: false, duongDan: "/co-so?loc=chung-nhan" },
  { id: "AL04", loai: "Công việc quá hạn", tieuDe: "9 công việc đã quá hạn hoàn thành", moTa: "Chỉ huy có thể yêu cầu cán bộ giải trình theo BR-06.", mucDo: "Cao", thoiDiem: gioLech(-1, 9, 0), daDoc: true, duongDan: "/cong-viec" },
  { id: "AL05", loai: "Hạn kiểm tra", tieuDe: "12 cuộc kiểm tra dự kiến trong tuần", moTa: "Trong đó 4 cuộc chưa gửi thông báo cho cơ sở.", mucDo: "Trung bình", thoiDiem: gioLech(-2, 14, 45), daDoc: true, duongDan: "/kiem-tra" },
  { id: "AL06", loai: "Sự cố cần xử lý", tieuDe: "2 hồ sơ sự cố quá hạn xử lý", moTa: "Vụ cháy ngày 22/07 và vụ CNCH ngày 03/08 chưa đóng hồ sơ.", mucDo: "Cao", thoiDiem: gioLech(-2, 10, 12), daDoc: true, duongDan: "/su-co" },
];
