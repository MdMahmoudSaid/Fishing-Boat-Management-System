// Garde d'autorisation pour toutes les routes /api/admin/*. C'est la
// véritable frontière de sécurité de l'espace admin : il n'y a pas de
// middleware.ts (le token vit en localStorage, pas dans un cookie, donc un
// middleware Edge ne pourrait de toute façon pas le lire) — chaque route
// vérifie donc elle-même le rôle du token, comme /api/sync/write vérifie déjà
// ses propres claims. Le garde-fou côté UI (app/(admin)/layout.tsx) n'est que
// du confort visuel, pas de la sécurité.
import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "@/lib/auth/verifyAccessToken";
import type { AccessTokenPayload } from "@/lib/auth/jwt";

function bearerToken(request: NextRequest): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length);
}

export type RequirePlatformAdminResult =
  | { ok: true; claims: AccessTokenPayload }
  | { ok: false; response: NextResponse };

export async function requirePlatformAdmin(request: NextRequest): Promise<RequirePlatformAdminResult> {
  const token = bearerToken(request);
  if (!token) {
    return { ok: false, response: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }

  let claims: AccessTokenPayload;
  try {
    claims = await verifyAccessToken(token);
  } catch {
    return { ok: false, response: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }

  if (claims.role !== "platform_admin") {
    return { ok: false, response: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }

  return { ok: true, claims };
}
