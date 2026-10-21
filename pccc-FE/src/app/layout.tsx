import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";

import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

const inter = localFont({
  src: "./fonts/InterVariable.woff2",
  weight: "100 900",
  style: "normal",
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Hệ thống Quản lý công tác PCCC & CNCH",
    template: "%s · PCCC & CNCH — PC07",
  },
  description:
    "Hệ thống quản lý công tác phòng cháy, chữa cháy và cứu nạn, cứu hộ — PC07, Đội Khu vực 10. Bản demo theo URD v1.0.",
  applicationName: "PCCC & CNCH",
  icons: { icon: "/icon.svg" },
  appleWebApp: {
    capable: true,
    title: "PCCC & CNCH",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#C8102E",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <TooltipProvider>
          {children}
          <Toaster />
        </TooltipProvider>
      </body>
    </html>
  );
}
