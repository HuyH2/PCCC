"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
export function LogoutButton() {
  const [error, setError] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  return (
    <>
      <Button
        variant="outline"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError(false);
          try {
            const response = await fetch("/api/auth/logout", { method: "POST" });
            if (!response.ok) throw new Error("Logout failed");
            window.location.assign("/dang-nhap");
          } catch {
            setError(true);
          } finally {
            setPending(false);
          }
        }}
      >
        {pending ? "Đang đăng xuất…" : "Đăng xuất"}
      </Button>
      {error && <p role="alert">Không thể đăng xuất. Vui lòng thử lại.</p>}
    </>
  );
}
