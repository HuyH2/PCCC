"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, ChevronRight, LogOut, Moon, Search, Sun, User2 } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { canhBaoList } from "@/data/mock";
import { nhanDuongDan } from "@/lib/navigation";
import {
  docPhien, phienMacDinh, tenVaiTro, theoDoiPhien, xoaPhien, type PhienDangNhap,
} from "@/lib/phien-dang-nhap";

function dungBreadcrumb(pathname: string) {
  if (pathname === "/") return [{ href: "/", label: "Tổng quan" }];
  const doan = pathname.split("/").filter(Boolean);
  const crumbs = [{ href: "/", label: "Trang chủ" }];
  let acc = "";
  for (const d of doan) {
    acc += `/${d}`;
    crumbs.push({ href: acc, label: nhanDuongDan[acc] ?? decodeURIComponent(d) });
  }
  return crumbs;
}

export function AppHeader() {
  const pathname = usePathname();
  const crumbs = dungBreadcrumb(pathname);
  const chuaDoc = canhBaoList.filter((c) => !c.daDoc).length;
  const [toi, setToi] = React.useState(false);

  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", toi);
  }, [toi]);

  // Phiên nằm trong localStorage nên chỉ đọc được sau khi component gắn vào DOM,
  // tránh lệch nội dung giữa lần render trên server và trên trình duyệt.
  // Header thuộc layout gốc và không được gắn lại khi điều hướng, nên phải
  // đọc lại mỗi khi phiên đổi thì mới hiện đúng người vừa đăng nhập.
  const [phien, setPhien] = React.useState<PhienDangNhap>(phienMacDinh);
  React.useEffect(() => {
    const docLai = () => setPhien(docPhien() ?? phienMacDinh);
    docLai();
    return theoDoiPhien(docLai);
  }, []);

  const chuCaiDau = phien.hoTen
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((t) => t[0] ?? "")
    .join("");

  return (
    <header className="bg-background/85 sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b px-3 backdrop-blur-sm sm:px-5">
      <SidebarTrigger />
      <Separator orientation="vertical" className="mr-1 h-5" />

      <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
        <ol className="flex min-w-0 items-center gap-1 text-sm">
          {crumbs.map((c, i) => (
            <li key={c.href} className="flex min-w-0 items-center gap-1">
              {i > 0 && <ChevronRight className="text-muted-foreground size-3.5 shrink-0" />}
              {i === crumbs.length - 1 ? (
                <span className="text-foreground truncate font-semibold">{c.label}</span>
              ) : (
                <Link
                  href={c.href}
                  className="text-muted-foreground hover:text-primary hidden truncate transition-colors sm:inline"
                >
                  {c.label}
                </Link>
              )}
            </li>
          ))}
        </ol>
      </nav>

      <Button variant="outline" size="sm" asChild className="hidden md:inline-flex">
        <Link href="/tra-cuu">
          <Search className="size-4" />
          <span className="text-muted-foreground font-normal">Tra cứu toàn hệ thống…</span>
        </Link>
      </Button>

      <Button variant="ghost" size="icon-sm" onClick={() => setToi((v) => !v)} aria-label="Đổi giao diện sáng/tối">
        {toi ? <Moon className="size-4" /> : <Sun className="size-4" />}
      </Button>

      <Button variant="ghost" size="icon-sm" asChild className="relative" aria-label="Cảnh báo">
        <Link href="/canh-bao">
          <Bell className="size-4" />
          {chuaDoc > 0 && (
            <span className="bg-primary text-primary-foreground absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full text-[10px] font-bold">
              {chuaDoc}
            </span>
          )}
        </Link>
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="hover:bg-accent flex cursor-pointer items-center gap-2 rounded-md py-1 pr-2 pl-1 transition-colors">
            <Avatar className="size-7">
              <AvatarFallback className="bg-primary text-primary-foreground">{chuCaiDau}</AvatarFallback>
            </Avatar>
            <span className="hidden text-left leading-tight lg:grid">
              <span className="text-[13px] font-semibold">{phien.hoTen}</span>
              <span className="text-muted-foreground text-[11px]">{phien.chucVu}</span>
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel className="font-normal">
            <div className="grid gap-1">
              <p className="text-sm font-semibold">
                {phien.capBac} {phien.hoTen}
              </p>
              <p className="text-muted-foreground text-xs">{phien.tenDangNhap}@pc07.gov.vn</p>
              <Badge variant="secondary" className="mt-1 w-fit">
                {phien.vaiTro} · {tenVaiTro[phien.vaiTro]}
              </Badge>
              <p className="text-muted-foreground mt-0.5 text-[11px]">
                Phạm vi dữ liệu: {phien.phamViDuLieu}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/to-chuc/can-bo">
              <User2 />
              Hồ sơ cán bộ
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/quan-tri/vai-tro">
              <Bell />
              Vai trò &amp; phạm vi dữ liệu
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={xoaPhien} asChild>
            <Link href="/dang-nhap">
              <LogOut />
              Đăng xuất
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
