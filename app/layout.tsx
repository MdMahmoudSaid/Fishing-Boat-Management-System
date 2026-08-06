import type { Metadata, Viewport } from "next";
import { El_Messiri, IBM_Plex_Sans_Arabic } from "next/font/google";
import Script from "next/script";
import { AuthProvider } from "@/lib/supabase/AuthProvider";
import { PowerSyncProvider } from "@/lib/powersync/PowerSyncProvider";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";
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
    // suppressHydrationWarning : le script ci-dessous modifie lang/dir sur
    // <html> avant l'hydratation (anti-FOUC, voir lib/i18n/index.ts), donc
    // le DOM peut ne plus correspondre au rendu serveur statique "ar"/"rtl"
    // au moment où React hydrate cet élément — comportement attendu.
    <html
      lang="ar"
      dir="rtl"
      className={`${displayFont.variable} ${bodyFont.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Anti-FOUC : lit la langue mise en cache localement et pose
            lang/dir sur <html> avant que quoi que ce soit ne s'affiche,
            sans appel réseau (offline-first). La clé "fbms:locale" doit
            rester synchronisée avec STORAGE_KEY dans lib/i18n/index.ts — un
            script inline ne peut pas importer cette constante. */}
        <Script id="locale-init" strategy="beforeInteractive">
          {`(function(){try{var v=localStorage.getItem("fbms:locale");var l=(v==="fr"||v==="ar")?v:"ar";document.documentElement.lang=l;document.documentElement.dir=l==="fr"?"ltr":"rtl";}catch(e){}})();`}
        </Script>
      </head>
      <body>
        <AuthProvider>
          <PowerSyncProvider>
            <LocaleProvider>{children}</LocaleProvider>
          </PowerSyncProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
