import { jwtVerify } from "jose";
import { requireEnv } from "@/lib/env";
import type { AccessTokenPayload } from "./jwt";

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  const secret = new TextEncoder().encode(requireEnv("JWT_SECRET"));
  const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });

  if (typeof payload.sub !== "string" || typeof payload.role !== "string") {
    throw new Error("JWT invalide : claims manquants");
  }
  // Absent pour un platform_admin (voir signAccessToken) — jamais présent
  // avec une autre valeur que string sinon.
  if (payload.companyId !== undefined && typeof payload.companyId !== "string") {
    throw new Error("JWT invalide : claims manquants");
  }

  return {
    sub: payload.sub,
    companyId: typeof payload.companyId === "string" ? payload.companyId : null,
    role: payload.role,
  };
}
