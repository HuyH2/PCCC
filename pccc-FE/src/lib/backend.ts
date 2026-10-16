import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { AuthUser } from "./auth-contract";

export function backendOrigin() {
  return process.env.BACKEND_URL || "http://127.0.0.1:4000";
}
export async function backendFetch(path: string) {
  const token = (await cookies()).get("pccc_session")?.value;
  return fetch(`${backendOrigin()}${path}`, {
    headers: token ? { Cookie: `pccc_session=${token}` } : {},
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  });
}
export async function currentUser(): Promise<AuthUser> {
  const response = await backendFetch("/api/auth/me");
  if (response.status === 401) redirect("/dang-nhap");
  if (!response.ok) throw new Error("Không thể kết nối dịch vụ xác thực.");
  return (await response.json()).user;
}
export async function requirePage(permission: string, administrator = false) {
  const user = await currentUser();
  if (user.mustChangePassword) redirect("/doi-mat-khau");
  if (
    !user.permissions.includes(permission) ||
    (administrator && (user.role !== "A05" || !user.scopes.some((s) => s.kind === "all")))
  )
    redirect("/khong-co-quyen");
  return user;
}
