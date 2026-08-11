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
  const token = bearerToken(request);
  if (!token) {
    return NextResponse.json({ code: "42501", message: "Authentification requise" }, { status: 401 });
  }

  let claims;
  try {
    claims = await verifyAccessToken(token);
  } catch {
    return NextResponse.json({ code: "42501", message: "Jeton invalide ou expiré" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body.table !== "string" || !isSyncOp(body.op) || typeof body.id !== "string") {
    return NextResponse.json({ code: "22P02", message: "Requête de synchro malformée" }, { status: 400 });
  }

  // Garde-fou : buildSyncQuery() ne vérifie pas que `data` est un objet non
  // vide sur PUT/PATCH — un `data` manquant/vide produirait un SET vide
  // dans le SQL généré (ex: "UPDATE boats SET  WHERE id = $1", rejeté par
  // Postgres avec une erreur de syntaxe peu explicite). DELETE n'utilise
  // pas `data`, donc pas concerné.
  if (body.op !== "DELETE") {
    const data = body.data;
    if (!data || typeof data !== "object" || Array.isArray(data) || Object.keys(data).length === 0) {
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
