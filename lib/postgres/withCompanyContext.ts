// Exécute `fn` dans une transaction où les variables de session
// app.company_id/app.user_id sont positionnées — lues par les policies RLS
// (db/migrations/20260804000001_rls_policies.sql). `set_config(..., true)`
// = portée transaction uniquement (équivalent paramétrable de SET LOCAL),
// jamais persistée sur la connexion réutilisée par le pool.
import type { PoolClient } from "pg";
import { getAppPool } from "./pool";

export async function withCompanyContext<T>(
  userId: string,
  companyId: string,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getAppPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.company_id', $1, true)", [companyId]);
    await client.query("SELECT set_config('app.user_id', $1, true)", [userId]);
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
