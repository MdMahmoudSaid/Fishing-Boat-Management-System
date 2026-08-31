import { NextRequest, NextResponse } from "next/server";
import { getAdminPool } from "@/lib/postgres/pool";
import { signAccessToken, ACCESS_TOKEN_TTL_SECONDS } from "@/lib/auth/jwt";
import { consumeRefreshToken, issueRefreshToken } from "@/lib/auth/refreshTokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface UserRow {
  id: string;
  company_id: string | null;
  role: string;
  is_active: boolean | null;
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const refreshToken = typeof body?.refreshToken === "string" ? body.refreshToken : "";
  if (!refreshToken) {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }

  const consumed = await consumeRefreshToken(refreshToken);
  if (!consumed) {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }

  const { rows } = await getAdminPool().query<UserRow>(
    `SELECT u.id, u.company_id, u.role, c.is_active
     FROM users u
     LEFT JOIN companies c ON c.id = u.company_id
     WHERE u.id = $1`,
    [consumed.userId],
  );
  const user = rows[0];
  // Company désactivée après ce login : on refuse le refresh, ce qui borne
  // la fenêtre d'accès résiduelle à la durée de vie de l'access token en
  // cours (≤ 1h, voir ACCESS_TOKEN_TTL_SECONDS) même si l'utilisateur était
  // déjà connecté.
  if (!user || user.is_active === false) {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }

  const accessToken = await signAccessToken({ sub: user.id, companyId: user.company_id, role: user.role });
  const newRefreshToken = await issueRefreshToken(user.id);

  return NextResponse.json({
    accessToken,
    refreshToken: newRefreshToken,
    expiresAt: Date.now() + ACCESS_TOKEN_TTL_SECONDS * 1000,
    user: { id: user.id, role: user.role },
  });
}
