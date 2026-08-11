// Lit une variable d'environnement serveur obligatoire, erreur explicite si
// absente — évite les erreurs Postgres/JWT peu claires en cas d'oubli de
// config (voir .env.example).
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} doit être défini (voir .env.example)`);
  }
  return value;
}
