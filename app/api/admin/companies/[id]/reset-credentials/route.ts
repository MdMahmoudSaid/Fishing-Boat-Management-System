// Remplace scripts/update-owner-credentials.ts pour l'usage courant : celui-ci
// supposait un seul owner dans TOUTE la base (cassé dès qu'il y a plus d'une
// company) — ici la mise à jour est explicitement scopée par company_id.
import { NextRequest, NextResponse } from "next/server";
import { getAdminPool } from "@/lib/postgres/pool";
import { requirePlatformAdmin } from "@/lib/admin/requirePlatformAdmin";
import { hashLoginCode } from "@/lib/auth/passwords";
import { isValidLoginCode, isValidMauritanianPhone } from "@/lib/auth/phoneAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const POSTGRES_UNIQUE_VIOLATION = "23505";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePlatformAdmin(request);
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const body = await request.json().catch(() => null);
  const phone = typeof body?.phone === "string" ? body.phone : "";
  const code = typeof body?.code === "string" ? body.code : "";

  if (!isValidMauritanianPhone(phone)) {
    return NextResponse.json({ error: "invalid_phone" }, { status: 400 });
  }
  if (!isValidLoginCode(code)) {
    return NextResponse.json({ error: "invalid_code" }, { status: 400 });
  }

  const pool = getAdminPool();
  const codeHash = await hashLoginCode(code);

  try {
    const { rows } = await pool.query<{ id: string }>(
      `UPDATE users SET phone = $1, code_hash = $2 WHERE company_id = $3 AND role = 'owner' RETURNING id`,
      [phone, codeHash, id],
    );
    const owner = rows[0];
    if (!owner) {
      return NextResponse.json({ error: "owner_not_found" }, { status: 404 });
    }

    // Les nouveaux identifiants doivent invalider les anciennes sessions :
    // sans ça, quelqu'un qui connaissait l'ancien code resterait connecté
    // jusqu'à expiration naturelle de son refresh token (90 jours).
    await pool.query(`DELETE FROM refresh_tokens WHERE user_id = $1`, [owner.id]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    if ((error as { code?: string })?.code === POSTGRES_UNIQUE_VIOLATION) {
      return NextResponse.json({ error: "phone_taken" }, { status: 409 });
    }
    throw error;
  }
}
