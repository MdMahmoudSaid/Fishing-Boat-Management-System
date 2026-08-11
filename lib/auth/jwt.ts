// Émission des JWT d'accès (HS256, secret partagé JWT_SECRET). Ce même
// secret configure la "Client Auth" de l'instance PowerSync (voir
// docs/GETTING_STARTED.md) : PowerSync doit vérifier exactement les mêmes
// tokens que nos routes API.
import { SignJWT } from "jose";
import { requireEnv } from "@/lib/env";

export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60; // 1h

// Identifiant de clé fixe pour notre unique clé symétrique HS256 — doit
// correspondre exactement au `kid` configuré dans
// client_auth.jwks.keys[].kid de l'instance PowerSync (voir
// docs/GETTING_STARTED.md). Ce n'est pas un secret et n'a pas besoin de
// varier par déploiement.
const KEY_ID = "fbms-hs256";

export interface AccessTokenPayload {
  sub: string;
  companyId: string;
  role: string;
}

export async function signAccessToken(payload: AccessTokenPayload): Promise<string> {
  const secret = new TextEncoder().encode(requireEnv("JWT_SECRET"));
  return new SignJWT({ companyId: payload.companyId, role: payload.role })
    .setProtectedHeader({ alg: "HS256", kid: KEY_ID })
    .setSubject(payload.sub)
    .setAudience(requireEnv("POWERSYNC_JWT_AUDIENCE"))
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(secret);
}
