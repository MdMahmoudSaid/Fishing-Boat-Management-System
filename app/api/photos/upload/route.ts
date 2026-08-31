import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "@/lib/auth/verifyAccessToken";
import { expensePhotoObjectPath, getMinioClient, PHOTOS_BUCKET } from "@/lib/storage/minioClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// expenses.id est toujours un UUID généré côté client (voir
// db/migrations/20260804000000_init_schema.sql) : on le vérifie strictement
// pour empêcher qu'un X-Expense-Id malveillant (ex. contenant "/" ou "..")
// ne fasse sortir la clé d'objet MinIO du préfixe {companyId}/ attendu.
const EXPENSE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let claims;
  try {
    claims = await verifyAccessToken(header.slice("Bearer ".length));
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Un platform_admin n'a pas de company (voir lib/auth/jwt.ts) : cette route
  // ne le concerne pas.
  if (!claims.companyId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const expenseId = request.headers.get("x-expense-id");
  if (!expenseId || !EXPENSE_ID_PATTERN.test(expenseId)) {
    return NextResponse.json({ error: "invalid_expense_id" }, { status: 400 });
  }

  const buffer = Buffer.from(await request.arrayBuffer());
  const objectPath = expensePhotoObjectPath(claims.companyId, expenseId);

  await getMinioClient().putObject(PHOTOS_BUCKET, objectPath, buffer, buffer.length, {
    "Content-Type": request.headers.get("content-type") ?? "image/jpeg",
  });

  return NextResponse.json({ path: objectPath });
}
