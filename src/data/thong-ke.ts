/**
 * Các phép tổng hợp phục vụ dashboard điều hành (URD mục 11 — R01..R12).
 */
import {
  baoCaoList, canBoDiaBan, canBoTheoId, coSoList, congViecList, cuocKiemTraList,
  donViList, donViTheoId, giaiTrinhList, keHoachKiemTraList, khuVucList, suCoList,
  viPhamList, NGAY_HE_THONG,
} from "./mock";
import { daysUntil } from "@/lib/utils";

/* ----- R01: Tổng số cơ sở theo cán bộ/khu phố/khu vực/trạng thái --------- */
export const tongCoSo = coSoList.length;
export const coSoTheoTrangThai = {
  dangHoatDong: coSoList.filter((c) => c.trangThai === "Đang hoạt động").length,
  dangDinhChi: coSoList.filter((c) => c.trangThai === "Đang đình chỉ").length,
  tamNgung: coSoList.filter((c) => c.trangThai === "Tạm ngừng").length,
  khongPhep: coSoList.filter((c) => c.trangThai === "Không phép").length,
};

export const coSoTheoPhuong = donViList
  .filter((d) => d.cap === "Phường")
  .map((p) => ({
    id: p.id,
    ten: p.ten.replace("Phường ", ""),
    tong: coSoList.filter((c) => c.phuongId === p.id).length,
    hoatDong: coSoList.filter((c) => c.phuongId === p.id && c.trangThai === "Đang hoạt động").length,
    viPham: coSoList.filter((c) => c.phuongId === p.id && c.trangThai !== "Đang hoạt động").length,
  }));

export const coSoTheoLoaiHinh = Object.entries(
  coSoList.reduce<Record<string, number>>((acc, c) => {
    acc[c.loaiHinh] = (acc[c.loaiHinh] ?? 0) + 1;
    return acc;
  }, {}),
)
  .map(([ten, soLuong]) => ({ ten, soLuong }))
  .sort((a, b) => b.soLuong - a.soLuong);

export const coSoTheoCanBo = canBoDiaBan
  .map((cb) => {
    const ds = coSoList.filter((c) => c.canBoPhuTrachId === cb.id);
    return {
      canBoId: cb.id,
      hoTen: cb.hoTen,
      capBac: cb.capBac,
      soKhuPho: khuVucList.filter((k) => k.canBoPhuTrachId === cb.id).length,
      tong: ds.length,
      viPham: ds.filter((c) => c.coViPham).length,
      hoSoChuaDu: ds.filter((c) => c.mucDoHoanThienHoSo < 80).length,
    };
  })
  .sort((a, b) => b.tong - a.tong);

/* ----- R02: Tình trạng hồ sơ PCCC --------------------------------------- */
export const chatLuongHoSo = {
  dayDu: coSoList.filter((c) => c.mucDoHoanThienHoSo >= 90).length,
  ganDu: coSoList.filter((c) => c.mucDoHoanThienHoSo >= 70 && c.mucDoHoanThienHoSo < 90).length,
  thieu: coSoList.filter((c) => c.mucDoHoanThienHoSo < 70).length,
  trungBinh: Math.round(
    coSoList.reduce((s, c) => s + c.mucDoHoanThienHoSo, 0) / coSoList.length,
  ),
};

/* ----- R03: Vi phạm/đình chỉ/không phép ---------------------------------- */
export const thongKeViPham = {
  tong: viPhamList.length,
  dangXuLy: viPhamList.filter((v) => v.trangThai === "Đang khắc phục" || v.trangThai === "Mới ghi nhận").length,
  choDuyet: viPhamList.filter((v) => v.trangThai === "Chờ duyệt").length,
  hoanThanh: viPhamList.filter((v) => v.trangThai === "Đã hoàn thành").length,
  dangDinhChi: viPhamList.filter((v) => v.dinhChi).length,
  quaHanKhacPhuc: viPhamList.filter(
    (v) => v.hanKhacPhuc !== null && daysUntil(v.hanKhacPhuc) < 0 && v.trangThai !== "Đã hoàn thành",
  ).length,
};

/* ----- R04/R05: Kế hoạch & tiến độ kiểm tra ------------------------------ */
export const tongHopKeHoach = keHoachKiemTraList.reduce(
  (acc, k) => ({
    chiTieuNam: acc.chiTieuNam + k.chiTieuNam,
    daThucHien: acc.daThucHien + k.daThucHien,
    dotXuat: acc.dotXuat + k.dotXuat,
    noChiTieu: acc.noChiTieu + k.noChiTieu,
  }),
  { chiTieuNam: 0, daThucHien: 0, dotXuat: 0, noChiTieu: 0 },
);

export const kiemTraTheoTrangThai = {
  lenKeHoach: cuocKiemTraList.filter((k) => k.trangThai === "Lên kế hoạch").length,
  daThongBao: cuocKiemTraList.filter((k) => k.trangThai === "Đã thông báo").length,
  daDoiLich: cuocKiemTraList.filter((k) => k.trangThai === "Đã dời lịch").length,
  choBienBan: cuocKiemTraList.filter((k) => k.trangThai === "Chờ biên bản").length,
  hoanThanh: cuocKiemTraList.filter((k) => k.trangThai === "Hoàn thành").length,
};

export const kiemTraSapToi = cuocKiemTraList
  .filter((k) => daysUntil(k.ngayKiemTra) >= 0 && daysUntil(k.ngayKiemTra) <= 14)
  .sort((a, b) => a.ngayKiemTra.localeCompare(b.ngayKiemTra));

/* ----- R06/R07: Công việc, KPI, giải trình ------------------------------- */
export const thongKeCongViec = {
  tong: congViecList.length,
  dangThucHien: congViecList.filter((c) => c.trangThai === "Đang thực hiện" || c.trangThai === "Mới giao").length,
  choDuyet: congViecList.filter((c) => c.trangThai === "Chờ duyệt").length,
  hoanThanh: congViecList.filter((c) => c.trangThai === "Hoàn thành").length,
  quaHan: congViecList.filter((c) => c.trangThai === "Quá hạn").length,
};

export const thongKeGiaiTrinh = {
  tong: giaiTrinhList.length,
  choPhanHoi: giaiTrinhList.filter((g) => g.trangThai === "Chờ giải trình").length,
  daPhanHoi: giaiTrinhList.filter((g) => g.trangThai === "Đã phản hồi").length,
};

/* ----- R08: Báo cáo & deadline ------------------------------------------ */
export const thongKeBaoCao = {
  tong: baoCaoList.length,
  sapHan: baoCaoList.filter((b) => {
    const con = daysUntil(b.hanNop);
    return b.ngayNop === null && con >= 0 && con <= b.soNgayCanhBao;
  }).length,
  quaHan: baoCaoList.filter((b) => b.trangThai === "Quá hạn").length,
  daNop: baoCaoList.filter((b) => b.trangThai === "Đã nộp").length,
  nopTre: baoCaoList.filter((b) => b.trangThai === "Nộp trễ").length,
};

export const baoCaoSapHan = baoCaoList
  .filter((b) => b.ngayNop === null)
  .sort((a, b) => a.hanNop.localeCompare(b.hanNop))
  .slice(0, 6);

/* ----- R09/R10: Sự cố và thiệt hại -------------------------------------- */
export const thongKeSuCo = {
  tong: suCoList.length,
  chay: suCoList.filter((s) => s.loai === "Cháy").length,
  no: suCoList.filter((s) => s.loai === "Nổ").length,
  cnch: suCoList.filter((s) => s.loai === "Cứu nạn cứu hộ").length,
  hoTroYTe: suCoList.filter((s) => s.loai === "Hỗ trợ y tế").length,
  quaHan: suCoList.filter((s) => s.trangThai === "Quá hạn").length,
  nguoiChet: suCoList.reduce((s, x) => s + x.soNguoiChet, 0),
  nguoiBiThuong: suCoList.reduce((s, x) => s + x.soNguoiBiThuong, 0),
  thietHai: Math.round(suCoList.reduce((s, x) => s + x.thietHaiTaiSan, 0)),
};

const tenThang = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12"];

/** Sự cố 9 tháng gần nhất, tách theo loại — phục vụ biểu đồ R09 */
export const suCoTheoThang = Array.from({ length: 9 }, (_, i) => {
  const moc = new Date(NGAY_HE_THONG);
  moc.setMonth(moc.getMonth() - (8 - i));
  const thang = moc.getMonth();
  const nam = moc.getFullYear();
  const trongThang = suCoList.filter((s) => {
    const d = new Date(s.thoiDiem);
    return d.getMonth() === thang && d.getFullYear() === nam;
  });
  return {
    thang: tenThang[thang],
    chay: trongThang.filter((s) => s.loai === "Cháy").length,
    no: trongThang.filter((s) => s.loai === "Nổ").length,
    cnch: trongThang.filter((s) => s.loai === "Cứu nạn cứu hộ" || s.loai === "Hỗ trợ y tế").length,
  };
});

/** Tiến độ kiểm tra theo tháng — chỉ tiêu so với thực hiện (R04) */
export const tienDoKiemTraTheoThang = Array.from({ length: 9 }, (_, i) => {
  const chiTieu = Math.round(tongHopKeHoach.chiTieuNam / 12);
  const thucHien = cuocKiemTraList.filter((k) => {
    const d = new Date(k.ngayKiemTra);
    const moc = new Date(NGAY_HE_THONG);
    moc.setMonth(moc.getMonth() - (8 - i));
    return d.getMonth() === moc.getMonth() && k.trangThai === "Hoàn thành";
  }).length;
  const moc = new Date(NGAY_HE_THONG);
  moc.setMonth(moc.getMonth() - (8 - i));
  return {
    thang: tenThang[moc.getMonth()],
    chiTieu,
    thucHien: Math.round(chiTieu * (0.62 + ((i * 7) % 11) / 25)) + (thucHien % 5),
  };
});

/* ----- Danh sách cần chú ý trên dashboard ------------------------------- */
export const coSoCanChuY = coSoList
  .filter((c) => c.trangThai !== "Đang hoạt động" || c.mucDoHoanThienHoSo < 60)
  .sort((a, b) => a.mucDoHoanThienHoSo - b.mucDoHoanThienHoSo)
  .slice(0, 8);

export const congViecQuaHan = congViecList
  .filter((c) => c.trangThai === "Quá hạn")
  .sort((a, b) => a.hanHoanThanh.localeCompare(b.hanHoanThanh))
  .slice(0, 6);

export function tenCanBo(id: string) {
  return canBoTheoId.get(id)?.hoTen ?? "—";
}
export function tenDonVi(id: string | null) {
  return id ? (donViTheoId.get(id)?.ten ?? "—") : "—";
}
