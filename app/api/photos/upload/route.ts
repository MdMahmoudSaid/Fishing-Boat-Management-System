import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "@/lib/auth/verifyAccessToken";
import { expensePhotoObjectPath, getMinioClient, PHOTOS_BUCKET } from "@/lib/storage/minioClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  const expenseId = request.headers.get("x-expense-id");
  if (!expenseId) {
    return NextResponse.json({ error: "missing_expense_id" }, { status: 400 });
  }

  const buffer = Buffer.from(await request.arrayBuffer());
  const objectPath = expensePhotoObjectPath(claims.companyId, expenseId);

  await getMinioClient().putObject(PHOTOS_BUCKET, objectPath, buffer, buffer.length, {
    "Content-Type": request.headers.get("content-type") ?? "image/jpeg",
  });

  return NextResponse.json({ path: objectPath });
}
