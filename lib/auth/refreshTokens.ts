// Refresh tokens stockés hachés (jamais en clair) dans public.refresh_tokens
// (db/migrations/20260806000000_refresh_tokens.sql). Rotation à chaque
// refresh : le token consommé est supprimé, un nouveau est émis par
// l'appelant — limite la fenêtre d'exploitation d'un token volé.
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { getAdminPool } from "@/lib/postgres/pool";

const REFRESH_TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 90; // 90 jours

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function issueRefreshToken(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await getAdminPool().query(
    `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)`,
    [randomUUID(), userId, hashToken(token), new Date(Date.now() + REFRESH_TOKEN_TTL_MS)],
  );
  return token;
}

export async function consumeRefreshToken(token: string): Promise<{ userId: string } | null> {
  const pool = getAdminPool();
  const { rows } = await pool.query<{ id: string; user_id: string; expires_at: Date }>(
    `SELECT id, user_id, expires_at FROM refresh_tokens WHERE token_hash = $1`,
    [hashToken(token)],
  );
  const row = rows[0];
  if (!row || row.expires_at.getTime() < Date.now()) return null;

  await pool.query(`DELETE FROM refresh_tokens WHERE id = $1`, [row.id]);
  return { userId: row.user_id };
}

export async function revokeRefreshToken(token: string): Promise<void> {
  await getAdminPool().query(`DELETE FROM refresh_tokens WHERE token_hash = $1`, [hashToken(token)]);
}
