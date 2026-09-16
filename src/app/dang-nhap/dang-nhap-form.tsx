"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ChevronRight, LogIn, ShieldCheck, Zap } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  luuPhien, taiKhoanDemo, taoPhien, tenVaiTro, type PhienDangNhap,
} from "@/lib/phien-dang-nhap";
import { taiKhoanList } from "@/data/mock";
import { cn } from "@/lib/utils";

/** Màu nhãn vai trò: quản trị và chỉ huy nổi bật hơn các vai trò còn lại. */
function mauVaiTro(vaiTro: string) {
  if (vaiTro === "A05") return "destructive" as const;
  if (vaiTro === "A01") return "default" as const;
  return "secondary" as const;
}

export function DangNhapForm() {
  const router = useRouter();
  const [tenDangNhap, setTenDangNhap] = React.useState("");
  const [matKhau, setMatKhau] = React.useState("demo1234");
  const [loi, setLoi] = React.useState<string | null>(null);
  const [dangVao, setDangVao] = React.useState<string | null>(null);

  function vaoHeThong(phien: PhienDangNhap) {
    setDangVao(phien.taiKhoanId);
    luuPhien(phien);
    router.push("/");
  }

  function dangNhapBangForm(e: React.FormEvent) {
    e.preventDefault();
    setLoi(null);

    const ten = tenDangNhap.trim().toLowerCase();
    if (!ten) {
      setLoi("Vui lòng nhập tên đăng nhập.");
      return;
    }

    const tk = taiKhoanList.find((t) => t.tenDangNhap.toLowerCase() === ten);
    if (!tk) {
      setLoi("Tên đăng nhập không tồn tại. Chọn nhanh một tài khoản demo bên dưới.");
      return;
    }
    if (tk.trangThai !== "Hoạt động") {
      setLoi("Tài khoản đang bị khóa hoặc đã ngưng sử dụng.");
      return;
    }

    const phien = taoPhien(tk.id);
    if (phien) vaoHeThong(phien);
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h2 className="text-2xl font-bold tracking-tight">Đăng nhập hệ thống</h2>
        <p className="text-muted-foreground text-sm">
          Sử dụng tài khoản được Quản trị hệ thống cấp cho cán bộ.
        </p>
      </div>

      <form onSubmit={dangNhapBangForm} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="tenDangNhap">Tên đăng nhập</Label>
          <Input
            id="tenDangNhap"
            name="tenDangNhap"
            placeholder="trang.dt"
            autoComplete="username"
            value={tenDangNhap}
            onChange={(e) => {
              setTenDangNhap(e.target.value);
              setLoi(null);
            }}
            aria-invalid={Boolean(loi)}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="matKhau">Mật khẩu</Label>
            <button type="button" className="text-primary cursor-pointer text-xs hover:underline">
              Quên mật khẩu?
            </button>
          </div>
          <Input
            id="matKhau"
            name="matKhau"
            type="password"
            autoComplete="current-password"
            value={matKhau}
            onChange={(e) => setMatKhau(e.target.value)}
          />
        </div>

        {loi && (
          <p className="text-destructive flex items-start gap-1.5 text-[13px] font-medium">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {loi}
          </p>
        )}

        <Button type="submit" className="w-full">
          <LogIn />
          Đăng nhập
        </Button>
      </form>

      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-muted-foreground text-xs whitespace-nowrap">hoặc vào nhanh bằng</span>
        <Separator className="flex-1" />
      </div>

      {/* Chọn nhanh tài khoản demo — bấm vào là vào thẳng hệ thống */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <Zap className="text-primary size-3.5" />
          <span className="text-[13px] font-semibold">Tài khoản demo</span>
          <span className="text-muted-foreground text-xs">— bấm để vào ngay</span>
        </div>

        <ul className="space-y-1.5">
          {taiKhoanDemo.map((tk) => (
            <li key={tk.taiKhoanId}>
              <button
                type="button"
                onClick={() => vaoHeThong(tk)}
                disabled={dangVao !== null}
                className={cn(
                  "group hover:border-primary/60 hover:bg-accent/50 flex w-full cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                  "focus-visible:border-ring focus-visible:ring-ring/40 outline-none focus-visible:ring-[3px]",
                  "disabled:pointer-events-none disabled:opacity-50",
                  dangVao === tk.taiKhoanId && "border-primary bg-accent",
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[13px] font-semibold">{tk.hoTen}</span>
                    <Badge variant={mauVaiTro(tk.vaiTro)} className="text-[10px]">
                      {tk.vaiTro}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground truncate text-xs">
                    {tk.chucVu} · <span className="font-mono">{tk.tenDangNhap}</span>
                  </p>
                  <p className="text-muted-foreground/80 truncate text-[11px]">
                    Phạm vi: {tk.phamViDuLieu}
                  </p>
                </div>
                <ChevronRight className="text-muted-foreground group-hover:text-primary size-4 shrink-0 transition-colors" />
              </button>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-muted-foreground flex gap-2 text-xs leading-relaxed">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
        <span>
          Danh sách tài khoản này <strong className="text-foreground">chỉ dùng cho bản demo</strong> và
          phải gỡ bỏ trước khi đưa lên môi trường chính thức. Hệ thống thật dùng tài khoản nội bộ và mật
          khẩu do Quản trị hệ thống cấp, bắt buộc đổi mật khẩu ở lần đăng nhập đầu tiên.
        </span>
      </p>
    </div>
  );
}
