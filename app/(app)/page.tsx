"use client";

import Link from "next/link";
import { useStatus } from "@powersync/react";
import {
  LayoutDashboard,
  Route,
  Ship,
  Users,
  Handshake,
  FileBarChart2,
  Settings,
  LogOut,
} from "lucide-react";
import { t } from "@/lib/i18n";
import { signOut } from "@/lib/auth/authClient";
import { Logo } from "@/components/ui/Logo";

const NAV_ITEMS = [
  { href: "/dashboard", labelKey: "dashboard.title", icon: LayoutDashboard },
  { href: "/trips", labelKey: "nav.trips", icon: Route },
  { href: "/boats", labelKey: "nav.boats", icon: Ship },
  { href: "/crew", labelKey: "nav.crew", icon: Users },
  { href: "/buyers", labelKey: "nav.buyers", icon: Handshake },
  { href: "/reports", labelKey: "reports.title", icon: FileBarChart2 },
  { href: "/settings", labelKey: "settings.title", icon: Settings },
] as const;

export default function HomePage() {
  const status = useStatus();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 p-6">
      <div className="flex items-start justify-between">
        <Logo size={44} withWordmark />
        <button
          onClick={() => signOut()}
          aria-label={t("auth.logout")}
          className="flex h-10 w-10 items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-sand-dim hover:text-danger dark:text-sand/50 dark:hover:bg-white/10"
        >
          <LogOut size={18} />
        </button>
      </div>

      <div>
        <span
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${
            status.connected
              ? "bg-success-soft text-success"
              : "bg-sand-dim text-ink-faint"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              status.connected ? "bg-success" : "bg-ink-faint"
            }`}
          />
          {status.connected ? t("sync.connected") : t("sync.offline")}
        </span>
      </div>

      <nav className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="group flex flex-col items-center gap-3 rounded-2xl border border-sand-dim bg-foam p-5 text-center shadow-[0_1px_2px_rgba(11,18,32,0.04)] transition-all hover:-translate-y-0.5 hover:border-rope/30 hover:shadow-md dark:border-white/10 dark:bg-white/5"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-rope-soft text-rope transition-colors group-hover:bg-rope group-hover:text-white dark:bg-white/10 dark:text-rope">
                <Icon size={22} />
              </span>
              <span className="text-sm font-medium text-ink dark:text-sand">
                {t(item.labelKey)}
              </span>
            </Link>
          );
        })}
      </nav>
    </main>
  );
}
