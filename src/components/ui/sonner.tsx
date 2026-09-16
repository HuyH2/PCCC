"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

/** Toast dùng chung, bám theo token màu của hệ thống. */
export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      position="top-right"
      toastOptions={{
        style: {
          background: "var(--popover)",
          color: "var(--popover-foreground)",
          border: "1px solid var(--border)",
        },
      }}
      {...props}
    />
  );
}
