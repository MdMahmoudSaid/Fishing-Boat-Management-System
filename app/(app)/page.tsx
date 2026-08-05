"use client";

import Link from "next/link";
import { useStatus } from "@powersync/react";
import { t } from "@/lib/i18n";
import { signOut } from "@/lib/supabase/auth";
import { Button } from "@/components/ui/Button";

const NAV_LINKS: { href: string; labelKey: Parameters<typeof t>[0] }[] = [
  { href: "/dashboard", labelKey: "dashboard.title" },
  { href: "/trips", labelKey: "nav.trips" },
  { href: "/boats", labelKey: "nav.boats" },
  { href: "/crew", labelKey: "nav.crew" },
  { href: "/buyers", labelKey: "nav.buyers" },
  { href: "/reports", labelKey: "reports.title" },
  { href: "/settings", labelKey: "settings.title" },
];

export default function HomePage() {
  const status = useStatus();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-bold">{t("app.name")}</h1>
      <p className="text-sm text-slate-500">
        {status.connected ? t("sync.connected") : t("sync.offline")}
      </p>

      <nav className="flex flex-wrap justify-center gap-4">
        {NAV_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="text-sm text-slate-700 underline dark:text-slate-300"
          >
            {t(link.labelKey)}
          </Link>
        ))}
      </nav>

      <Button variant="secondary" onClick={() => signOut()}>
        {t("auth.logout")}
      </Button>
    </main>
  );
}
