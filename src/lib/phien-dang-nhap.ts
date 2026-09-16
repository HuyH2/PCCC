"use client";

import { canBoTheoId, taiKhoanList } from "@/data/mock";
import type { ActorCode } from "@/data/types";

/**
 * Phiên đăng nhập của bản demo.
 *
 * Bản demo chưa có backend nên phiên chỉ được lưu trong localStorage của trình duyệt
 * và KHÔNG có giá trị bảo mật. Khi nối API thật, thay toàn bộ file này bằng phiên
 * do server cấp (cookie HttpOnly) và bỏ phần đọc/ghi localStorage.
 */
const KHOA_LUU = "pccc.phien-dang-nhap";

/**
 * Header nằm ở layout gốc nên không được gắn lại khi điều hướng trong ứng dụng.
 * Vì vậy mỗi lần phiên đổi phải phát một sự kiện để những nơi đang hiển thị
 * thông tin người dùng đọc lại, thay vì chỉ đọc một lần lúc gắn vào DOM.
 */
const SU_KIEN_DOI_PHIEN = "pccc:phien-thay-doi";

export interface PhienDangNhap {
  taiKhoanId: string;
  tenDangNhap: string;
  canBoId: string;
  hoTen: string;
  capBac: string;
  chucVu: string;
  vaiTro: ActorCode;
  phamViDuLieu: string;
}

export const tenVaiTro: Record<ActorCode, string> = {
  A01: "Chỉ huy/Đội trưởng",
  A02: "Phó chỉ huy/Tổ trưởng",
  A03: "Cán bộ kiểm tra/Quản lý địa bàn",
  A04: "Cán bộ tổng hợp",
  A05: "Quản trị hệ thống",
  A06: "Lãnh đạo cấp phòng/Người xem",
  A07: "Cấp phường (mở rộng)",
};

/** Dựng thông tin phiên từ một tài khoản trong danh sách mẫu. */
export function taoPhien(taiKhoanId: string): PhienDangNhap | null {
  const tk = taiKhoanList.find((t) => t.id === taiKhoanId);
  if (!tk) return null;
  const cb = canBoTheoId.get(tk.canBoId);
  if (!cb) return null;
  return {
    taiKhoanId: tk.id,
    tenDangNhap: tk.tenDangNhap,
    canBoId: cb.id,
    hoTen: cb.hoTen,
    capBac: cb.capBac,
    chucVu: cb.chucVu,
    vaiTro: tk.vaiTro,
    phamViDuLieu: tk.phamViDuLieu,
  };
}

/** Tài khoản dùng khi chưa ai đăng nhập — Đội trưởng Kv10. */
export const phienMacDinh: PhienDangNhap = taoPhien("TK002")!;

export function luuPhien(phien: PhienDangNhap) {
  try {
    localStorage.setItem(KHOA_LUU, JSON.stringify(phien));
  } catch {
    // Trình duyệt chặn localStorage (chế độ riêng tư) — bỏ qua, phiên chỉ tồn tại trong tab.
  }
  window.dispatchEvent(new CustomEvent(SU_KIEN_DOI_PHIEN));
}

export function docPhien(): PhienDangNhap | null {
  try {
    const raw = localStorage.getItem(KHOA_LUU);
    if (!raw) return null;
    const p = JSON.parse(raw) as PhienDangNhap;
    return p?.taiKhoanId ? p : null;
  } catch {
    return null;
  }
}

export function xoaPhien() {
  try {
    localStorage.removeItem(KHOA_LUU);
  } catch {
    // Bỏ qua như trên.
  }
  window.dispatchEvent(new CustomEvent(SU_KIEN_DOI_PHIEN));
}

/**
 * Lắng nghe thay đổi phiên: sự kiện nội bộ khi đăng nhập/đăng xuất ở tab hiện tại,
 * và sự kiện "storage" khi người dùng đổi tài khoản ở tab khác.
 * Trả về hàm gỡ bỏ để component dọn dẹp khi bị tháo khỏi DOM.
 */
export function theoDoiPhien(khiDoi: () => void) {
  window.addEventListener(SU_KIEN_DOI_PHIEN, khiDoi);
  window.addEventListener("storage", khiDoi);
  return () => {
    window.removeEventListener(SU_KIEN_DOI_PHIEN, khiDoi);
    window.removeEventListener("storage", khiDoi);
  };
}

/** Danh sách tài khoản demo hiển thị ngoài màn hình đăng nhập, đủ 6 vai trò A01-A06. */
export const taiKhoanDemo = ["TK011", "TK002", "TK003", "TK004", "TK007", "TK001"]
  .map(taoPhien)
  .filter((p): p is PhienDangNhap => p !== null);
