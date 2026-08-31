// Fetch authentifié pour l'espace /admin, qui n'a pas de base de données
// locale PowerSync (contrairement au reste de l'app) : ses pages lisent/
// écrivent directement via les routes /api/admin/* en HTTP, avec le token
// d'accès en Bearer (même convention que /api/sync/write).
"use client";

import { readSession, clearSession } from "@/lib/auth/session";

export class AdminFetchError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const session = readSession();
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
      ...(session ? { Authorization: `Bearer ${session.accessToken}` } : {}),
    },
  });

  if (response.status === 401) {
    // Token absent/expiré/invalide : pas de session admin exploitable, on
    // repart du login plutôt que de laisser la page dans un état incohérent.
    clearSession();
    // Rechargement complet volontaire (pas de useRouter ici : adminFetch est
    // une fonction utilitaire, pas un composant) — un plein reload garantit
    // aussi que tout état PowerSync/React résiduel est réinitialisé.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/login";
    throw new AdminFetchError("unauthorized", 401);
  }

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = typeof body?.error === "string" ? body.error : `Requête ${path} échouée`;
    throw new AdminFetchError(message, response.status);
  }

  return body as T;
}
