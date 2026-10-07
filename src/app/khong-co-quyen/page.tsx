import Link from "next/link";
import { currentUser } from "@/lib/backend";
import { canVisit } from "@/lib/auth-contract";
import { Button } from "@/components/ui/button";
import { LogoutButton } from "./logout-button";

export default async function ForbiddenPage() {
  const user = await currentUser();
  return (
    <main className="mx-auto flex min-h-svh max-w-lg flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-bold">Không thể truy cập chức năng</h1>
      <p>Tài khoản chưa được cấp quyền truy cập chức năng này. Liên hệ quản trị hệ thống.</p>
      {canVisit(user, "/") && (
        <Button asChild>
          <Link href="/">Về tổng quan</Link>
        </Button>
      )}
      {canVisit(user, "/quan-tri/vai-tro") && (
        <Button asChild>
          <Link href="/quan-tri/vai-tro">Cấu hình quyền</Link>
        </Button>
      )}
      <LogoutButton />
    </main>
  );
}
