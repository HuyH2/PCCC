import { NextRequest, NextResponse } from "next/server";
import { canVisit, type AuthUser } from "./lib/auth-contract";

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path.startsWith("/api/") || path === "/dang-nhap") return NextResponse.next();
  const token = request.cookies.get("pccc_session")?.value;
  if (!token) return NextResponse.redirect(new URL("/dang-nhap", request.url));
  try {
    const response = await fetch(
      `${process.env.BACKEND_URL || "http://127.0.0.1:4000"}/api/auth/me`,
      {
        headers: { Cookie: `pccc_session=${token}` },
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      },
    );
    if (response.status === 401) {
      const redirect = NextResponse.redirect(new URL("/dang-nhap", request.url));
      redirect.cookies.delete("pccc_session");
      return redirect;
    }
    if (!response.ok) throw new Error("Authentication unavailable");
    const user: AuthUser = (await response.json()).user;
    if (user.mustChangePassword && path !== "/doi-mat-khau")
      return NextResponse.redirect(new URL("/doi-mat-khau", request.url));
    if (path === "/doi-mat-khau" || path === "/khong-co-quyen") return NextResponse.next();
    if (path === "/tong-quan") return NextResponse.redirect(new URL("/", request.url));
    if (path === "/du-lieu/co-so" || path.startsWith("/du-lieu/co-so/"))
      return NextResponse.redirect(new URL(path.replace("/du-lieu/co-so", "/co-so"), request.url));
    if (!canVisit(user, path))
      return NextResponse.redirect(new URL("/khong-co-quyen", request.url));
    return NextResponse.next();
  } catch {
    return new NextResponse("Dịch vụ xác thực tạm thời không khả dụng. Vui lòng thử lại.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
