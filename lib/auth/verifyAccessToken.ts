import { jwtVerify } from "jose";
import { requireEnv } from "@/lib/env";
import type { AccessTokenPayload } from "./jwt";

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  const secret = new TextEncoder().encode(requireEnv("JWT_SECRET"));
  const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });

  if (
    typeof payload.sub !== "string" ||
    typeof payload.companyId !== "string" ||
    typeof payload.role !== "string"
  ) {
    throw new Error("JWT invalide : claims manquants");
  }

  return { sub: payload.sub, companyId: payload.companyId, role: payload.role };
}
