import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { requirePage } from "@/lib/backend";
import { AccountList } from "./account-list";

export const metadata = { title: "Quản lý tài khoản" };

export default async function AccountPage() {
  const user = await requirePage("M01.view", true);
  return (
    <div className="space-y-5">
      <PageHeader
        title="Quản lý tài khoản người dùng"
        description="Khóa hoặc mở khóa tài khoản; tài khoản bị khóa mất phiên đăng nhập ngay."
        module="M01"
        useCases={["UC-ADM-02", "UC-ADM-04"]}
        actions={
          <Button asChild variant="outline">
            <Link href="/to-chuc/phan-cong">Chuyển giao phạm vi</Link>
          </Button>
        }
      />
      <AccountList canEdit={user.permissions.includes("M01.edit")} currentAccountId={user.id} />
    </div>
  );
}
