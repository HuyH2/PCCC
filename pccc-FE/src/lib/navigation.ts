import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle, BadgeCheck, Bell, Building2, CalendarClock, ClipboardCheck,
  ClipboardList, Database, FileSearch, FileSpreadsheet, FileText, Flame,
  Gauge, History, LayoutDashboard, Map, Scale, ScrollText, Search, Settings2,
  ShieldAlert, Siren, Target, UserCog, Users, Workflow,
} from "lucide-react";

import type { ModuleCode } from "@/data/types";

export interface NavItem {
  title: string;
  href: string;
  icon?: LucideIcon;
  /** Mã phân hệ theo URD mục 4 */
  module?: ModuleCode;
  /** Mã Use Case liên quan theo URD mục 7 */
  useCases?: string[];
  badge?: string;
  items?: NavItem[];
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/**
 * Cây điều hướng bám theo 11 phân hệ M01-M11 của URD v1.0.
 */
export const navGroups: NavGroup[] = [
  {
    label: "Điều hành",
    items: [
      { title: "Tổng quan", href: "/", icon: LayoutDashboard, module: "M10", useCases: ["UC-SYS-02"] },
      { title: "Tra cứu toàn hệ thống", href: "/tra-cuu", icon: Search, module: "M10", useCases: ["UC-SYS-01"] },
      { title: "Cảnh báo & nhắc việc", href: "/canh-bao", icon: Bell, module: "M10", useCases: ["UC-SYS-03"] },
    ],
  },
  {
    label: "Quản lý địa bàn",
    items: [
      {
        title: "Tổ chức - Cán bộ",
        href: "/to-chuc",
        icon: Users,
        module: "M02",
        items: [
          { title: "Cơ cấu đơn vị", href: "/to-chuc/don-vi", icon: Workflow, useCases: ["UC-ORG-01"] },
          { title: "Danh bạ cán bộ", href: "/to-chuc/can-bo", icon: Users, useCases: ["UC-ORG-02"] },
          { title: "Khu vực - Khu phố", href: "/to-chuc/khu-vuc", icon: Map, useCases: ["UC-ORG-03"] },
          { title: "Phân công phụ trách", href: "/to-chuc/phan-cong", icon: UserCog, useCases: ["UC-ORG-03"] },
        ],
      },
      {
        title: "Cơ sở & hồ sơ",
        href: "/co-so",
        icon: Building2,
        module: "M03",
        useCases: ["UC-FAC-01", "UC-FAC-02"],
      },
      {
        title: "Vi phạm - Đình chỉ",
        href: "/vi-pham",
        icon: ShieldAlert,
        module: "M04",
        useCases: ["UC-VIO-01", "UC-VIO-05"],
      },
    ],
  },
  {
    label: "Nghiệp vụ",
    items: [
      {
        title: "Công tác kiểm tra",
        href: "/kiem-tra",
        icon: ClipboardCheck,
        module: "M06",
        items: [
          { title: "Kế hoạch & chỉ tiêu", href: "/kiem-tra/ke-hoach", icon: Target, useCases: ["UC-INS-01", "UC-INS-02"] },
          { title: "Cuộc kiểm tra", href: "/kiem-tra/cuoc-kiem-tra", icon: ClipboardList, useCases: ["UC-INS-03"] },
        ],
      },
      {
        title: "Lịch - Công việc - KPI",
        href: "/cong-viec",
        icon: CalendarClock,
        module: "M07",
        items: [
          { title: "Lịch công tác", href: "/cong-viec/lich", icon: CalendarClock, useCases: ["UC-WRK-01"] },
          { title: "Giao việc & tiến độ", href: "/cong-viec/giao-viec", icon: ClipboardList, useCases: ["UC-WRK-02", "UC-WRK-03"] },
          { title: "KPI & nợ chỉ tiêu", href: "/cong-viec/kpi", icon: Gauge, useCases: ["UC-WRK-04"] },
          { title: "Yêu cầu giải trình", href: "/cong-viec/giai-trinh", icon: FileSearch, useCases: ["UC-WRK-05"] },
        ],
      },
      {
        title: "Báo cáo - Deadline",
        href: "/bao-cao",
        icon: FileSpreadsheet,
        module: "M08",
        useCases: ["UC-RPT-01", "UC-RPT-03"],
      },
      { title: "Sự cố cháy nổ - CNCH", href: "/su-co", icon: Siren, module: "M09", useCases: ["UC-INC-01"] },
      { title: "Văn bản - Quy chuẩn", href: "/van-ban", icon: Scale, module: "M05", useCases: ["UC-DOC-01"] },
    ],
  },
  {
    label: "Hệ thống",
    items: [
      {
        title: "Số hóa dữ liệu",
        href: "/tien-ich",
        icon: Database,
        module: "M11",
        items: [
          { title: "Import Excel", href: "/tien-ich/import", icon: FileSpreadsheet, useCases: ["UC-FAC-07", "UC-SYS-04"] },
          { title: "Kết xuất dữ liệu", href: "/tien-ich/export", icon: FileText, useCases: ["UC-RPT-06"] },
        ],
      },
      {
        title: "Quản trị",
        href: "/quan-tri",
        icon: Settings2,
        module: "M01",
        items: [
          { title: "Tài khoản", href: "/quan-tri/tai-khoan", icon: BadgeCheck, useCases: ["UC-ADM-02"] },
          { title: "Vai trò & phạm vi", href: "/quan-tri/vai-tro", icon: UserCog, useCases: ["UC-ADM-03"] },
          { title: "Nhật ký thao tác", href: "/quan-tri/nhat-ky", icon: History, useCases: ["UC-SYS-05"] },
        ],
      },
    ],
  },
];

/** Bản đồ đường dẫn -> nhãn, dùng dựng breadcrumb */
export const nhanDuongDan: Record<string, string> = (() => {
  const map: Record<string, string> = {
    "/": "Tổng quan",
    "/to-chuc": "Tổ chức - Cán bộ",
    "/kiem-tra": "Công tác kiểm tra",
    "/cong-viec": "Lịch - Công việc - KPI",
    "/tien-ich": "Số hóa dữ liệu",
    "/quan-tri": "Quản trị",
  };
  for (const group of navGroups) {
    for (const item of group.items) {
      map[item.href] = item.title;
      for (const sub of item.items ?? []) map[sub.href] = sub.title;
    }
  }
  return map;
})();

/** Tên phân hệ theo URD mục 4 */
export const tenPhanHe: Record<ModuleCode, string> = {
  M01: "Quản trị & phân quyền",
  M02: "Tổ chức - cán bộ - địa bàn",
  M03: "Cơ sở & hồ sơ",
  M04: "Vi phạm - đình chỉ - khắc phục",
  M05: "Văn bản pháp luật/quy chuẩn",
  M06: "Công tác kiểm tra",
  M07: "Lịch - công việc - KPI",
  M08: "Báo cáo - deadline",
  M09: "Sự cố",
  M10: "Tra cứu - dashboard - cảnh báo",
  M11: "Số hóa - import/export - vận hành",
};

export const iconPhanHe: Record<ModuleCode, LucideIcon> = {
  M01: Settings2, M02: Users, M03: Building2, M04: ShieldAlert, M05: ScrollText,
  M06: ClipboardCheck, M07: CalendarClock, M08: FileSpreadsheet, M09: Flame,
  M10: Gauge, M11: Database,
};

export const iconCanhBao = AlertTriangle;
