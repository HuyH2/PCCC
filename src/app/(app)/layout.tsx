import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

/**
 * Khung ứng dụng: sidebar + header.
 *
 * Nằm trong route group "(app)" nên màn hình đăng nhập không dựng khung này —
 * tránh việc sidebar và header vẫn ở trong DOM và nhận được tiêu điểm bàn phím
 * khi người dùng chưa đăng nhập.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <AppHeader />
        <div className="flex-1 p-4 sm:p-5 lg:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
