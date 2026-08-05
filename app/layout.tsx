import type { Metadata, Viewport } from "next";
import { El_Messiri, IBM_Plex_Sans_Arabic } from "next/font/google";
import { AuthProvider } from "@/lib/supabase/AuthProvider";
import { PowerSyncProvider } from "@/lib/powersync/PowerSyncProvider";
import "./globals.css";

// El Messiri : police d'affichage (titres, logo) — du caractère, lisible en
// arabe. IBM Plex Sans Arabic : police de corps (texte courant, formulaires,
// données) — très lisible, chiffres latins cohérents avec MRU/dates.
const displayFont = El_Messiri({
  subsets: ["arabic", "latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

const bodyFont = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

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
  themeColor: "#0b1220",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl" className={`${displayFont.variable} ${bodyFont.variable}`}>
      <body>
        <AuthProvider>
          <PowerSyncProvider>{children}</PowerSyncProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
