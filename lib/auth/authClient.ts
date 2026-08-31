// Remplace lib/supabase/auth.ts. `phoneDigits` : 8 chiffres locaux, déjà
// validés côté formulaire (voir app/(auth)/login/page.tsx).
import { clearSession, readSession, writeSession, type Session } from "./session";

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: { id: string; role: string };
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Requête ${path} échouée (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export async function signIn(phoneDigits: string, code: string): Promise<Session> {
  const session = await postJson<AuthResponse>("/api/auth/login", { phone: phoneDigits, code });
  writeSession(session);
  return session;
}

export async function signOut(): Promise<void> {
  const session = readSession();
  clearSession();
  if (session) {
    // Best effort : la session locale est déjà effacée, un échec réseau ne
    // doit pas bloquer la déconnexion côté app.
    await fetch("/api/auth/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: session.refreshToken }),
    }).catch(() => {});
  }
}

export async function refreshSession(session: Session): Promise<Session> {
  const next = await postJson<AuthResponse>("/api/auth/refresh", {
    refreshToken: session.refreshToken,
  });
  writeSession(next);
  return next;
}
