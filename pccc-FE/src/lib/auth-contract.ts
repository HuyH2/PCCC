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

/** UC-INS-06 — mirrors requireChecklistAuthor: M06.create plus Chỉ huy (A01) / Phó chỉ huy (A02). */
export function canCreateChecklist(user: AuthUser) {
  return (
    user.permissions.includes("M06.view") &&
    user.permissions.includes("M06.create") &&
    user.scopes.length > 0 &&
    (user.role === "A01" || user.role === "A02")
  );
}

/** Preserve existing demo screens. Backend enforces permissions on its APIs. */
export function canVisit(user: AuthUser, path: string) {
  if (path === "/quan-tri/vai-tro" || path === "/quan-tri/nhat-ky") {
    return (
      user.permissions.includes("M01.view") &&
      user.role === "A05" &&
      user.scopes.some((scope) => scope.kind === "all")
    );
  }
  if (path === "/kiem-tra/checklist/tao") return canCreateChecklist(user);
  if (
    path === "/kiem-tra/checklist" ||
    path === "/kiem-tra/thuc-hien" ||
    path.startsWith("/kiem-tra/thuc-hien/")
  ) {
    if (!user.permissions.includes("M06.view") || !user.scopes.length) return false;
    return path !== "/kiem-tra/thuc-hien/tao" || user.permissions.includes("M06.create");
  }
  if (path === "/van-ban" || path.startsWith("/van-ban/")) {
    if (!user.permissions.includes("M05.view") || !user.scopes.length) return false;
    const action = path === "/van-ban/them" ? "create" : path.endsWith("/sua") ? "edit" : null;
    return (
      !action ||
      (user.permissions.includes(`M05.${action}`) && user.scopes.some((s) => s.kind === "all"))
    );
  }
  return true;
}
