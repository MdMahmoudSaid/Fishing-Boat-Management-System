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
  company_id: string;
  role: string;
  code_hash: string;
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const phone = typeof body?.phone === "string" ? body.phone : "";
  const code = typeof body?.code === "string" ? body.code : "";

  if (!isValidMauritanianPhone(phone) || !isValidLoginCode(code)) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const { rows } = await getAdminPool().query<UserRow>(
    `SELECT id, company_id, role, code_hash FROM users WHERE phone = $1`,
    [phone],
  );
  const user = rows[0];

  if (!user || !(await verifyLoginCode(code, user.code_hash))) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const accessToken = await signAccessToken({ sub: user.id, companyId: user.company_id, role: user.role });
  const refreshToken = await issueRefreshToken(user.id);

  return NextResponse.json({
    accessToken,
    refreshToken,
    expiresAt: Date.now() + ACCESS_TOKEN_TTL_SECONDS * 1000,
    user: { id: user.id },
  });
}
