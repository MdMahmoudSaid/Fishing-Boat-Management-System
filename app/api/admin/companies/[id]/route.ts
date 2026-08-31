import { NextRequest, NextResponse } from "next/server";
import { getAdminPool } from "@/lib/postgres/pool";
import { requirePlatformAdmin } from "@/lib/admin/requirePlatformAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CompanyDetailRow {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  owner_id: string | null;
  owner_name: string | null;
  owner_phone: string | null;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePlatformAdmin(request);
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const { rows } = await getAdminPool().query<CompanyDetailRow>(
    `SELECT c.id, c.name, c.is_active, c.created_at, u.id AS owner_id, u.name AS owner_name, u.phone AS owner_phone
     FROM companies c
     LEFT JOIN users u ON u.company_id = c.id AND u.role = 'owner'
     WHERE c.id = $1`,
    [id],
  );
  const company = rows[0];
  if (!company) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ company });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePlatformAdmin(request);
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const body = await request.json().catch(() => null);
  const isActive = typeof body?.isActive === "boolean" ? body.isActive : undefined;
  const name = typeof body?.name === "string" ? body.name.trim() : undefined;

  if (isActive === undefined && name === undefined) {
    return NextResponse.json({ error: "no_changes" }, { status: 400 });
  }
  if (name !== undefined && name === "") {
    return NextResponse.json({ error: "invalid_name" }, { status: 400 });
  }

  const pool = getAdminPool();

  // Désactiver une company révoque immédiatement les sessions déjà émises
  // pour ses utilisateurs (login/refresh la rejettent aussi, voir
  // app/api/auth/login et .../refresh, mais l'access token en cours reste
  // valide jusqu'à ≤1h — révoquer les refresh tokens force une reconnexion
  // à la prochaine tentative de refresh au lieu d'attendre l'expiration).
  if (isActive === false) {
    await pool.query(
      `DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE company_id = $1)`,
      [id],
    );
  }

  const { rows } = await pool.query<{ id: string }>(
    `UPDATE companies SET
       is_active = COALESCE($2, is_active),
       name = COALESCE($3, name)
     WHERE id = $1
     RETURNING id`,
    [id, isActive ?? null, name ?? null],
  );

  if (rows.length === 0) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
