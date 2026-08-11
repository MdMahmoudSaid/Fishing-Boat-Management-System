import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "@/lib/auth/verifyAccessToken";
import { withCompanyContext } from "@/lib/postgres/withCompanyContext";
import { buildSyncQuery, SyncWriteError, type SyncOperation } from "@/lib/postgres/syncWrite";
import { NON_RETRYABLE_POSTGRES_ERROR_CODES } from "@/lib/postgres/postgresErrorCodes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bearerToken(request: NextRequest): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length);
}

function isSyncOp(value: unknown): value is SyncOperation["op"] {
  return value === "PUT" || value === "PATCH" || value === "DELETE";
}

export async function POST(request: NextRequest) {
  // Ces deux échecs d'authentification NE DOIVENT PAS réutiliser un code
  // Postgres présent dans NON_RETRYABLE_POSTGRES_ERROR_CODES (ex: "42501") :
  // BackendConnector.isNonRetryableError() écarterait alors définitivement
  // l'écriture locale en attente (transaction.complete()) au lieu de la
  // renvoyer plus tard une fois le token rafraîchi. "AUTH_REQUIRED" n'étant
  // pas dans cet ensemble, le connecteur la traite comme transitoire et
  // réessaiera après un nouveau login/refresh.
  const token = bearerToken(request);
  if (!token) {
    return NextResponse.json({ code: "AUTH_REQUIRED", message: "Authentification requise" }, { status: 401 });
  }

  let claims;
  try {
    claims = await verifyAccessToken(token);
  } catch {
    return NextResponse.json({ code: "AUTH_REQUIRED", message: "Jeton invalide ou expiré" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body.table !== "string" || !isSyncOp(body.op) || typeof body.id !== "string") {
    return NextResponse.json({ code: "22P02", message: "Requête de synchro malformée" }, { status: 400 });
  }

  // Garde-fou : buildSyncQuery() ne vérifie pas que `data` contient au moins
  // une colonne à écrire sur PUT/PATCH — un `data` manquant/vide, ou ne
  // contenant que "id" (qui est de toute façon exclu du SET), produirait un
  // SET vide dans le SQL généré (ex: "UPDATE boats SET  WHERE id = $1"),
  // rejeté par Postgres avec une erreur de syntaxe peu explicite. On
  // vérifie donc qu'il reste au moins une clé autre que "id" après filtrage.
  // DELETE n'utilise pas `data`, donc pas concerné.
  if (body.op !== "DELETE") {
    const data = body.data;
    const hasWritableColumn =
      data && typeof data === "object" && !Array.isArray(data) &&
      Object.keys(data).some((key) => key !== "id");
    if (!hasWritableColumn) {
      return NextResponse.json({ code: "22P02", message: "Requête de synchro malformée" }, { status: 400 });
    }
  }

  try {
    const query = buildSyncQuery({ table: body.table, op: body.op, id: body.id, data: body.data });
    await withCompanyContext(claims.sub, claims.companyId, (client) => client.query(query.text, query.values));
    return NextResponse.json({ ok: true });
  } catch (error) {
    const code = error instanceof SyncWriteError ? error.code : (error as { code?: string })?.code;
    const message = error instanceof Error ? error.message : "Erreur de synchro";
    const status = code && NON_RETRYABLE_POSTGRES_ERROR_CODES.has(code) ? 409 : 500;
    return NextResponse.json({ code: code ?? "UNKNOWN", message }, { status });
  }
}
