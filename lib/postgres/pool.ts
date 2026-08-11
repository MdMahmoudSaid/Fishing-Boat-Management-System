// Deux connexions Postgres distinctes, par niveau de privilège :
// - adminPool (DATABASE_URL) : sans RLS, réservé aux routes qui doivent
//   chercher un utilisateur par téléphone avant qu'une session n'existe
//   (/api/auth/login, /api/auth/refresh) — joue le rôle que Supabase Auth
//   (GoTrue) jouait avec sa propre connexion privilégiée.
// - appPool (APP_DATABASE_URL, rôle `app`) : RLS active, utilisée
//   uniquement par /api/sync/write, avec le contexte de session positionné
//   par withCompanyContext() avant chaque requête.
import { Pool } from "pg";
import { requireEnv } from "@/lib/env";

let adminPool: Pool | null = null;
let appPool: Pool | null = null;

export function getAdminPool(): Pool {
  if (!adminPool) {
    adminPool = new Pool({ connectionString: requireEnv("DATABASE_URL") });
  }
  return adminPool;
}

export function getAppPool(): Pool {
  if (!appPool) {
    appPool = new Pool({ connectionString: requireEnv("APP_DATABASE_URL") });
  }
  return appPool;
}
