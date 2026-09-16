"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatNumber } from "@/lib/utils";

export function DataPagination({
  tong,
  trang,
  soDong,
  onDoiTrang,
  onDoiSoDong,
}: {
  tong: number;
  trang: number;
  soDong: number;
  onDoiTrang: (trang: number) => void;
  onDoiSoDong: (soDong: number) => void;
}) {
  const tongTrang = Math.max(1, Math.ceil(tong / soDong));
  const tu = tong === 0 ? 0 : (trang - 1) * soDong + 1;
  const den = Math.min(trang * soDong, tong);

  return (
    <div className="flex flex-col-reverse items-center justify-between gap-3 border-t px-3 py-2.5 sm:flex-row">
      <p className="text-muted-foreground text-[13px]">
        Kết quả <strong className="text-foreground font-semibold">{formatNumber(tu)}</strong>–
        <strong className="text-foreground font-semibold">{formatNumber(den)}</strong> trong{" "}
        <strong className="text-foreground font-semibold">{formatNumber(tong)}</strong> bản ghi
      </p>
      <div className="flex items-center gap-2">
        <Select
          value={String(soDong)}
          onValueChange={(v) => {
            onDoiSoDong(Number(v));
            onDoiTrang(1);
          }}
        >
          <SelectTrigger size="sm" className="w-[74px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[10, 20, 50, 100].map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon-sm" disabled={trang === 1} onClick={() => onDoiTrang(1)}>
            <ChevronsLeft className="size-4" />
          </Button>
          <Button variant="outline" size="icon-sm" disabled={trang === 1} onClick={() => onDoiTrang(trang - 1)}>
            <ChevronLeft className="size-4" />
          </Button>
          <span className="px-2 text-[13px] font-medium tabular-nums">
            {trang} / {tongTrang}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            disabled={trang >= tongTrang}
            onClick={() => onDoiTrang(trang + 1)}
          >
            <ChevronRight className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            disabled={trang >= tongTrang}
            onClick={() => onDoiTrang(tongTrang)}
          >
            <ChevronsRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
