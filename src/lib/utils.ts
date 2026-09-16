import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Định dạng số theo chuẩn Việt Nam: 1.234.567 */
export function formatNumber(value: number) {
  return new Intl.NumberFormat("vi-VN").format(value);
}

/** Định dạng ngày dd/MM/yyyy từ chuỗi ISO */
export function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

/** Số ngày còn lại tới hạn (âm = đã quá hạn) */
export function daysUntil(iso: string) {
  const target = new Date(iso).setHours(0, 0, 0, 0);
  const today = new Date().setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86_400_000);
}

/** Bỏ dấu tiếng Việt để tìm kiếm không phân biệt dấu */
export function deaccent(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}
