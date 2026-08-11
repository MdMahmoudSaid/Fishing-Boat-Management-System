import { NextRequest, NextResponse } from "next/server";
import { getAdminPool } from "@/lib/postgres/pool";
import { signAccessToken, ACCESS_TOKEN_TTL_SECONDS } from "@/lib/auth/jwt";
import { consumeRefreshToken, issueRefreshToken } from "@/lib/auth/refreshTokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface UserRow {
  id: string;
  company_id: string;
  role: string;
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
    `SELECT id, company_id, role FROM users WHERE id = $1`,
    [consumed.userId],
  );
  const user = rows[0];
  if (!user) {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }

  const accessToken = await signAccessToken({ sub: user.id, companyId: user.company_id, role: user.role });
  const newRefreshToken = await issueRefreshToken(user.id);

  return NextResponse.json({
    accessToken,
    refreshToken: newRefreshToken,
    expiresAt: Date.now() + ACCESS_TOKEN_TTL_SECONDS * 1000,
    user: { id: user.id },
  });
}
