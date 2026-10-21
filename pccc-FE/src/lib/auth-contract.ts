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

/** UC-DOC-02 — management is limited to Commander and Admin with an active scope and grant. */
export function canManageDocuments(user: AuthUser, action: "create" | "edit") {
  return (
    (user.role === "A01" || user.role === "A05") &&
    user.scopes.length > 0 &&
    user.permissions.includes("M05.view") &&
    user.permissions.includes(`M05.${action}`)
  );
}

/** Preserve existing demo screens. Backend enforces permissions on its APIs. */
export function canVisit(user: AuthUser, path: string) {
  if (path === "/bao-cao" || path.startsWith("/bao-cao/"))
    return user.permissions.includes("M08.view") && user.scopes.length > 0;
  if (path === "/tien-ich/export") {
    return (
      user.scopes.length > 0 &&
      user.permissions.some((permission) => permission.endsWith(".export"))
    );
  }
  if (path === "/to-chuc/khu-vuc") {
    return user.permissions.includes("M02.view") && user.scopes.length > 0;
  }
  if (path === "/to-chuc/phan-cong") {
    const administrator =
      user.permissions.includes("M01.view") &&
      user.role === "A05" &&
      user.scopes.some((scope) => scope.kind === "all");
    const commander =
      user.permissions.includes("M02.view") &&
      user.permissions.includes("M02.edit") &&
      user.scopes.length > 0;
    return administrator || commander;
  }
  if (path === "/quan-tri/tai-khoan") {
    return (
      user.permissions.includes("M01.view") &&
      user.role === "A05" &&
      user.scopes.some((scope) => scope.kind === "all")
    );
  }
  if (path === "/quan-tri/vai-tro" || path === "/quan-tri/nhat-ky") {
    return (
      user.permissions.includes("M01.view") &&
      user.role === "A05" &&
      user.scopes.some((scope) => scope.kind === "all")
    );
  }
  if (path === "/kiem-tra/checklist/tao") return canCreateChecklist(user);
  if (path === "/cong-viec/giao-viec" || path.startsWith("/cong-viec/giao-viec/"))
    return user.permissions.includes("M07.view") && user.scopes.length > 0;
  if (
    path === "/kiem-tra/ke-hoach" ||
    path === "/kiem-tra/cuoc-kiem-tra" ||
    path.startsWith("/kiem-tra/cuoc-kiem-tra/") ||
    path === "/kiem-tra/lich"
  ) {
    return user.permissions.includes("M06.view") && user.scopes.length > 0;
  }
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
    return !action || canManageDocuments(user, action);
  }
  return true;
}
