import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { currentUser } from "@/lib/backend";
import { redirect } from "next/navigation";

/**
 * Khung ứng dụng: sidebar + header.
 *
 * Nằm trong route group "(app)" nên màn hình đăng nhập không dựng khung này —
 * tránh việc sidebar và header vẫn ở trong DOM và nhận được tiêu điểm bàn phím
 * khi người dùng chưa đăng nhập.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (user.mustChangePassword) redirect("/doi-mat-khau");
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <AppHeader user={user} />
        <div className="flex-1 p-4 sm:p-5 lg:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
