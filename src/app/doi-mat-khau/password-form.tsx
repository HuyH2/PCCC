"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  async function skip() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/skip-password-change", { method: "POST" });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error?.message || "Không thể bỏ qua đổi mật khẩu.");
        return;
      }
      window.location.assign(result.redirectTo);
    } catch {
      setError("Không thể kết nối máy chủ.");
    } finally {
      setPending(false);
    }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    setError(null);
    if (newPassword !== confirm) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }
    setPending(true);
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error?.message || "Không thể đổi mật khẩu.");
        return;
      }
      window.location.assign("/dang-nhap");
    } catch {
      setError("Không thể kết nối máy chủ.");
    } finally {
      setPending(false);
    }
  }
  return (
    <form className="space-y-4" onSubmit={submit}>
      <div className="space-y-2">
        <Label htmlFor="current">Mật khẩu hiện tại</Label>
        <Input
          id="current"
          type="password"
          autoComplete="current-password"
          required
          maxLength={256}
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="new">Mật khẩu mới (ít nhất 12 ký tự)</Label>
        <Input
          id="new"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          maxLength={256}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm">Xác nhận mật khẩu mới</Label>
        <Input
          id="confirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          maxLength={256}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <Button className="w-full" disabled={pending}>
        {pending ? "Đang lưu…" : "Đổi mật khẩu và đăng nhập lại"}
      </Button>
      <Button type="button" variant="outline" className="w-full" disabled={pending} onClick={skip}>
        Bỏ qua, đổi sau
      </Button>
    </form>
  );
}
