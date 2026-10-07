import type { ActorCode } from "@/data/types";

export interface DataScope {
  kind: "all" | "unit" | "region" | "facility";
  targetId: string | null;
}
export interface AuthUser {
  id: string;
  username: string;
  fullName: string;
  officerId: string;
  role: ActorCode;
  mustChangePassword: boolean;
  permissions: string[];
  scopes: DataScope[];
}
export const roleNames: Record<ActorCode, string> = {
  A01: "Chỉ huy/Đội trưởng",
  A02: "Phó chỉ huy/Tổ trưởng",
  A03: "Cán bộ kiểm tra/Quản lý địa bàn",
  A04: "Cán bộ tổng hợp",
  A05: "Quản trị hệ thống",
  A06: "Lãnh đạo cấp phòng/Người xem",
  A07: "Cấp phường (mở rộng)",
};

/** Preserve existing demo screens. Backend enforces permissions on its APIs. */
export function canVisit(user: AuthUser, path: string) {
  if (path === "/quan-tri/vai-tro") {
    return (
      user.permissions.includes("M01.view") &&
      user.role === "A05" &&
      user.scopes.some((scope) => scope.kind === "all")
    );
  }
  return true;
}
