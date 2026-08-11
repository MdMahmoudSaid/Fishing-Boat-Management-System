"use client";

// Remplace lib/supabase/AuthProvider.tsx. Lit la session persistée au
// montage (offline-first : pas d'appel réseau nécessaire pour ouvrir
// l'app), puis tente un rafraîchissement silencieux en arrière-plan quand
// le token approche l'expiration ET que le réseau est disponible — même
// contrat que "token refresh happens silently when back online" (PROJECT_PLAN
// §6). Un échec de refresh (hors-ligne, refresh token expiré) ne vide pas
// la session : l'app reste utilisable hors-ligne jusqu'au prochain succès.
import { createContext, useContext, useEffect, useState } from "react";
import { needsRefresh, readSession, subscribeSessionChange, type Session } from "./session";
import { refreshSession } from "./authClient";

interface AuthContextValue {
  session: Session | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue>({ session: null, loading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setSession(readSession());
    setLoading(false);
    return subscribeSessionChange(() => setSession(readSession()));
  }, []);

  useEffect(() => {
    if (!session || typeof navigator === "undefined") return;

    async function maybeRefresh() {
      if (!navigator.onLine || !needsRefresh(session!)) return;
      try {
        await refreshSession(session!);
      } catch {
        // Voir commentaire d'en-tête : on garde la session actuelle.
      }
    }

    void maybeRefresh();
    window.addEventListener("online", maybeRefresh);
    return () => window.removeEventListener("online", maybeRefresh);
  }, [session]);

  return <AuthContext.Provider value={{ session, loading }}>{children}</AuthContext.Provider>;
}

export function useSession(): AuthContextValue {
  return useContext(AuthContext);
}
