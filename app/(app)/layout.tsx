"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePowerSync } from "@powersync/react";
import { useSession } from "@/lib/auth/AuthProvider";
import { getSessionRole } from "@/lib/auth/session";
import { registerPhotoUploadQueueListener } from "@/lib/sync/photoUploadQueue";
import { LoadingScreen } from "@/components/ui/LoadingScreen";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { session, loading } = useSession();
  const router = useRouter();
  const powersync = usePowerSync();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace("/login");
      return;
    }
    // Un platform_admin n'a pas de company : cet espace (PowerSync, pages
    // boats/trips/...) ne le concerne pas, voir lib/powersync/PowerSyncProvider.tsx.
    if (getSessionRole(session) === "platform_admin") {
      router.replace("/admin");
    }
  }, [loading, session, router]);

  // File d'attente photos : traite les envois en attente dès que l'app est
  // active et à chaque retour de connexion (§3 du PROJECT_PLAN).
  useEffect(() => {
    if (!session) return;
    return registerPhotoUploadQueueListener(powersync);
  }, [session, powersync]);

  if (loading || !session || getSessionRole(session) === "platform_admin") {
    return <LoadingScreen />;
  }

  return <>{children}</>;
}
