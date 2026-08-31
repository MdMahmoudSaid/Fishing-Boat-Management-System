"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth/AuthProvider";
import { getSessionRole } from "@/lib/auth/session";
import { signOut } from "@/lib/auth/authClient";
import { t } from "@/lib/i18n";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";

// Groupe de routes séparé de (app) : ne rend jamais les pages boats/trips/...
// (qui dépendent de PowerSync, jamais connecté pour un platform_admin — voir
// lib/powersync/PowerSyncProvider.tsx). Reste sous app/layout.tsx (Auth/
// PowerSync/Locale providers), donc pas de nouveau provider ici.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { session, loading } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace("/login");
      return;
    }
    // Garde-fou d'UX seulement : la vraie frontière de sécurité est
    // lib/admin/requirePlatformAdmin.ts côté serveur, sur chaque route
    // /api/admin/*. Un owner qui arrive ici est simplement renvoyé chez lui.
    if (getSessionRole(session) !== "platform_admin") {
      router.replace("/");
    }
  }, [loading, session, router]);

  if (loading || !session || getSessionRole(session) !== "platform_admin") {
    return <LoadingScreen />;
  }

  return (
    <div className="min-h-screen bg-sand dark:bg-ink">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-sand-dim bg-sand/90 px-6 py-4 backdrop-blur-sm dark:border-white/10 dark:bg-ink/90">
        <div className="flex items-center gap-3">
          <Logo size={32} />
          <p className="font-display text-base font-semibold text-ink dark:text-sand">
            {t("admin.title")}
          </p>
        </div>
        <Button variant="secondary" onClick={() => signOut().then(() => router.replace("/login"))}>
          {t("auth.logout")}
        </Button>
      </header>
      <main className="mx-auto flex max-w-3xl flex-col gap-4 p-6">{children}</main>
    </div>
  );
}
