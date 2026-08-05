import type { Metadata, Viewport } from "next";
import { AuthProvider } from "@/lib/supabase/AuthProvider";
import { PowerSyncProvider } from "@/lib/powersync/PowerSyncProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "نظام إدارة قوارب الصيد",
  description: "إدارة سورتيات الصيد، المصاريف، المبيعات والأرباح",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "قوارب الصيد",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <AuthProvider>
          <PowerSyncProvider>{children}</PowerSyncProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
