"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Flame } from "lucide-react";

import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupLabel,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub,
  SidebarMenuSubButton, SidebarMenuSubItem, useSidebar,
} from "@/components/ui/sidebar";
import { navGroups, type NavItem } from "@/lib/navigation";
import { cn } from "@/lib/utils";

function laDuongDanHoatDong(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function MenuCoCapCon({ item, pathname }: { item: NavItem; pathname: string }) {
  const { state, setOpen } = useSidebar();
  const dangHoatDong = laDuongDanHoatDong(pathname, item.href);
  const [mo, setMo] = React.useState(dangHoatDong);

  React.useEffect(() => {
    if (dangHoatDong) setMo(true);
  }, [dangHoatDong]);

  const Icon = item.icon;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        tooltip={item.title}
        isActive={dangHoatDong && state === "collapsed"}
        aria-expanded={mo}
        onClick={() => {
          if (state === "collapsed") {
            setOpen(true);
            setMo(true);
            return;
          }
          setMo((v) => !v);
        }}
      >
        {Icon ? <Icon /> : null}
        <span>{item.title}</span>
        <ChevronRight
          className={cn(
            "ml-auto size-4 transition-transform duration-200 group-data-[collapsible=icon]:hidden",
            mo && "rotate-90",
          )}
        />
      </SidebarMenuButton>
      {mo && (
        <SidebarMenuSub>
          {item.items!.map((sub) => (
            <SidebarMenuSubItem key={sub.href}>
              <SidebarMenuSubButton asChild isActive={laDuongDanHoatDong(pathname, sub.href)}>
                <Link href={sub.href}>
                  {sub.icon ? <sub.icon /> : null}
                  <span>{sub.title}</span>
                </Link>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          ))}
        </SidebarMenuSub>
      )}
    </SidebarMenuItem>
  );
}

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-sidebar-border border-b">
        <Link href="/" className="flex items-center gap-2.5 px-1 py-1">
          <span className="bg-sidebar-primary text-sidebar-primary-foreground flex size-9 shrink-0 items-center justify-center rounded-lg shadow-sm">
            <Flame className="size-5" />
          </span>
          <span className="grid min-w-0 flex-1 leading-tight group-data-[collapsible=icon]:hidden">
            <span className="truncate text-sm font-bold tracking-tight">PCCC &amp; CNCH</span>
            <span className="text-sidebar-foreground/70 truncate text-[11px]">
              PC07 · Đội Khu vực 10
            </span>
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent className="py-1">
        {navGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarMenu>
              {group.items.map((item) =>
                item.items?.length ? (
                  <MenuCoCapCon key={item.href} item={item} pathname={pathname} />
                ) : (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      tooltip={item.title}
                      isActive={laDuongDanHoatDong(pathname, item.href)}
                    >
                      <Link href={item.href}>
                        {item.icon ? <item.icon /> : null}
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ),
              )}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-sidebar-border border-t">
        <p className="text-sidebar-foreground/60 px-1 text-[11px] leading-relaxed group-data-[collapsible=icon]:hidden">
          URD v1.0 · Bản demo dùng <strong className="font-semibold">dữ liệu mẫu</strong> theo NFR-02.
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}
