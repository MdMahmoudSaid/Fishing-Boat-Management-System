import { NextRequest, NextResponse } from "next/server";
import { revokeRefreshToken } from "@/lib/auth/refreshTokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const refreshToken = typeof body?.refreshToken === "string" ? body.refreshToken : "";
  if (refreshToken) {
    await revokeRefreshToken(refreshToken);
  }
  return NextResponse.json({ ok: true });
}
