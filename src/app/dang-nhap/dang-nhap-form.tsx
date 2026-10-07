"use client";

import * as React from "react";
import { AlertCircle, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function DangNhapForm() {
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error?.message || "Không thể đăng nhập.");
        return;
      }
      window.location.assign(result.redirectTo);
    } catch {
      setError("Không thể kết nối máy chủ. Vui lòng thử lại.");
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Đăng nhập hệ thống</h2>
        <p className="text-muted-foreground mt-2 text-sm">
          Sử dụng tài khoản do Quản trị hệ thống cấp.
        </p>
      </div>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="username">Tên đăng nhập</Label>
          <Input
            id="username"
            autoComplete="username"
            required
            maxLength={100}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={pending}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Mật khẩu</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            maxLength={256}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={pending}
          />
        </div>
        {error && (
          <p role="alert" className="text-destructive flex gap-2 text-sm">
            <AlertCircle className="size-4 shrink-0" />
            {error}
          </p>
        )}
        <Button className="w-full" disabled={pending}>
          <LogIn />
          {pending ? "Đang đăng nhập…" : "Đăng nhập"}
        </Button>
      </form>
      <p className="text-muted-foreground text-xs">
        Tài khoản bị khóa hoặc ngưng hoạt động không thể đăng nhập. Liên hệ quản trị nếu cần cấp lại
        mật khẩu.
      </p>
    </div>
  );
}
