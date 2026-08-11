// Émission des JWT d'accès (HS256, secret partagé JWT_SECRET). Ce même
// secret configure la "Client Auth" de l'instance PowerSync (voir
// docs/GETTING_STARTED.md) : PowerSync doit vérifier exactement les mêmes
// tokens que nos routes API.
import { SignJWT } from "jose";
import { requireEnv } from "@/lib/env";

export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60; // 1h

export interface AccessTokenPayload {
  sub: string;
  companyId: string;
  role: string;
}

export async function signAccessToken(payload: AccessTokenPayload): Promise<string> {
  const secret = new TextEncoder().encode(requireEnv("JWT_SECRET"));
  return new SignJWT({ companyId: payload.companyId, role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(secret);
}
