import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "@/lib/auth/verifyAccessToken";
import { getMinioClient, PHOTOS_BUCKET } from "@/lib/storage/minioClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
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

  const { path } = await params;
  const objectPath = path.join("/");
  if (!objectPath.startsWith(`${claims.companyId}/`)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const stream = await getMinioClient().getObject(PHOTOS_BUCKET, objectPath);
    return new NextResponse(stream as unknown as ReadableStream, {
      headers: { "Content-Type": "image/jpeg" },
    });
  } catch {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
}
