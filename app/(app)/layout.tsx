"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePowerSync } from "@powersync/react";
import { useSession } from "@/lib/supabase/AuthProvider";
import { registerPhotoUploadQueueListener } from "@/lib/sync/photoUploadQueue";
import { t } from "@/lib/i18n";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { session, loading } = useSession();
  const router = useRouter();
  const powersync = usePowerSync();

  useEffect(() => {
    if (!loading && !session) {
      router.replace("/login");
    }
  }, [loading, session, router]);

  // File d'attente photos : traite les envois en attente dès que l'app est
  // active et à chaque retour de connexion (§3 du PROJECT_PLAN).
  useEffect(() => {
    if (!session) return;
    return registerPhotoUploadQueueListener(powersync);
  }, [session, powersync]);

  if (loading || !session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-sand dark:bg-ink">
        <p className="text-sm text-ink-faint">{t("common.loading")}</p>
      </main>
    );
  }

  return <>{children}</>;
}
