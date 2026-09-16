"use client";

import * as React from "react";
import { Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface BoLoc {
  key: string;
  label: string;
  options: { value: string; label: string }[];
  width?: string;
}

/**
 * Thanh tìm kiếm + bộ lọc dùng chung cho các màn hình danh sách.
 * Giá trị "all" nghĩa là không lọc theo tiêu chí đó.
 */
export function FilterBar({
  tuKhoa,
  onTuKhoa,
  placeholder = "Tìm theo tên, mã, địa chỉ…",
  boLoc = [],
  giaTri,
  onDoiGiaTri,
  children,
  className,
}: {
  tuKhoa: string;
  onTuKhoa: (v: string) => void;
  placeholder?: string;
  boLoc?: BoLoc[];
  giaTri: Record<string, string>;
  onDoiGiaTri: (key: string, value: string) => void;
  children?: React.ReactNode;
  className?: string;
}) {
  const coLoc = tuKhoa !== "" || Object.values(giaTri).some((v) => v !== "all");

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <div className="relative min-w-[210px] flex-1 sm:max-w-sm">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
        <Input
          value={tuKhoa}
          onChange={(e) => onTuKhoa(e.target.value)}
          placeholder={placeholder}
          className="pl-8.5"
        />
      </div>

      {boLoc.map((bl) => (
        <Select key={bl.key} value={giaTri[bl.key] ?? "all"} onValueChange={(v) => onDoiGiaTri(bl.key, v)}>
          <SelectTrigger className={cn("w-[170px]", bl.width)}>
            <SelectValue placeholder={bl.label} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{bl.label}: tất cả</SelectItem>
            {bl.options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ))}

      {coLoc && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onTuKhoa("");
            for (const bl of boLoc) onDoiGiaTri(bl.key, "all");
          }}
        >
          <X />
          Xóa lọc
        </Button>
      )}

      {children && <div className="ml-auto flex items-center gap-2">{children}</div>}
    </div>
  );
}

/** Hook quản lý state lọc + phân trang cho màn hình danh sách. */
export function useDanhSach<T>(nguon: T[], loc: (item: T, tuKhoa: string, giaTri: Record<string, string>) => boolean) {
  const [tuKhoa, setTuKhoa] = React.useState("");
  const [giaTri, setGiaTri] = React.useState<Record<string, string>>({});
  const [trang, setTrang] = React.useState(1);
  const [soDong, setSoDong] = React.useState(20);

  const ketQua = React.useMemo(
    () => nguon.filter((item) => loc(item, tuKhoa, giaTri)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nguon, tuKhoa, giaTri],
  );

  const trangHienTai = Math.min(trang, Math.max(1, Math.ceil(ketQua.length / soDong)));
  const duLieuTrang = ketQua.slice((trangHienTai - 1) * soDong, trangHienTai * soDong);

  const doiGiaTri = React.useCallback((key: string, value: string) => {
    setGiaTri((prev) => ({ ...prev, [key]: value }));
    setTrang(1);
  }, []);

  const doiTuKhoa = React.useCallback((v: string) => {
    setTuKhoa(v);
    setTrang(1);
  }, []);

  return {
    tuKhoa, doiTuKhoa, giaTri, doiGiaTri,
    ketQua, duLieuTrang,
    trang: trangHienTai, setTrang, soDong, setSoDong,
  };
}
