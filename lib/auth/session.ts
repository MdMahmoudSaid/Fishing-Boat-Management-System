// Session persistée en localStorage, condition nécessaire pour que l'app
// s'ouvre hors-ligne après un premier login (voir PROJECT_PLAN §6) —
// remplace la gestion interne de @supabase/supabase-js
// (persistSession/autoRefreshToken). subscribeSessionChange() remplace
// supabase.auth.onAuthStateChange() : AuthProvider (Task 15) s'y abonne
// pour refléter un login/logout déclenché ailleurs (lib/auth/authClient.ts).
export interface Session {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: { id: string };
}

const STORAGE_KEY = "fbms:session";
const EXPIRY_MARGIN_MS = 5 * 60 * 1000;

type Listener = () => void;
const listeners = new Set<Listener>();

function storage(): Storage | null {
  return typeof localStorage === "undefined" ? null : localStorage;
}

function notify(): void {
  listeners.forEach((listener) => listener());
}

export function readSession(): Session | null {
  const raw = storage()?.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export function writeSession(session: Session): void {
  storage()?.setItem(STORAGE_KEY, JSON.stringify(session));
  notify();
}

export function clearSession(): void {
  storage()?.removeItem(STORAGE_KEY);
  notify();
}

export function subscribeSessionChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function needsRefresh(session: Session): boolean {
  return session.expiresAt - EXPIRY_MARGIN_MS < Date.now();
}
