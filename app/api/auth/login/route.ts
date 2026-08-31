import { NextRequest, NextResponse } from "next/server";
import { getAdminPool } from "@/lib/postgres/pool";
import { verifyLoginCode } from "@/lib/auth/passwords";
import { signAccessToken, ACCESS_TOKEN_TTL_SECONDS } from "@/lib/auth/jwt";
import { issueRefreshToken } from "@/lib/auth/refreshTokens";
import { isValidLoginCode, isValidMauritanianPhone } from "@/lib/auth/phoneAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface UserRow {
  id: string;
  company_id: string | null;
  role: string;
  code_hash: string;
  // `null` pour un platform_admin (pas de company) — traité comme "actif".
  is_active: boolean | null;
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const phone = typeof body?.phone === "string" ? body.phone : "";
  const code = typeof body?.code === "string" ? body.code : "";

  if (!isValidMauritanianPhone(phone) || !isValidLoginCode(code)) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const { rows } = await getAdminPool().query<UserRow>(
    `SELECT u.id, u.company_id, u.role, u.code_hash, c.is_active
     FROM users u
     LEFT JOIN companies c ON c.id = u.company_id
     WHERE u.phone = $1`,
    [phone],
  );
  const user = rows[0];

  if (!user || !(await verifyLoginCode(code, user.code_hash))) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  // Un compte dont la company a été désactivée par un platform_admin ne peut
  // plus se connecter (§ deactivation). Message générique volontaire : ne
  // pas distinguer d'une simple erreur de code, pour ne pas divulguer l'état
  // de la company à quelqu'un qui ne fait que deviner des identifiants.
  if (user.is_active === false) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const accessToken = await signAccessToken({ sub: user.id, companyId: user.company_id, role: user.role });
  const refreshToken = await issueRefreshToken(user.id);

  return NextResponse.json({
    accessToken,
    refreshToken,
    expiresAt: Date.now() + ACCESS_TOKEN_TTL_SECONDS * 1000,
    user: { id: user.id, role: user.role },
  });
}
