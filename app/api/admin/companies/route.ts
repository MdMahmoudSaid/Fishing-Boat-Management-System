import { NextRequest, NextResponse } from "next/server";
import { getAdminPool } from "@/lib/postgres/pool";
import { createCompany } from "@/lib/admin/createCompany";
import { DuplicatePhoneError, ValidationError } from "@/lib/admin/errors";
import { requirePlatformAdmin } from "@/lib/admin/requirePlatformAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CompanyListRow {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  owner_name: string | null;
  owner_phone: string | null;
}

export async function GET(request: NextRequest) {
  const guard = await requirePlatformAdmin(request);
  if (!guard.ok) return guard.response;

  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";

  const { rows } = await getAdminPool().query<CompanyListRow>(
    `SELECT c.id, c.name, c.is_active, c.created_at, u.name AS owner_name, u.phone AS owner_phone
     FROM companies c
     LEFT JOIN users u ON u.company_id = c.id AND u.role = 'owner'
     WHERE $1 = '' OR c.name ILIKE '%' || $1 || '%' OR u.phone ILIKE '%' || $1 || '%'
     ORDER BY c.created_at DESC`,
    [query],
  );

  return NextResponse.json({ companies: rows });
}

export async function POST(request: NextRequest) {
  const guard = await requirePlatformAdmin(request);
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => null);
  const companyName = typeof body?.companyName === "string" ? body.companyName : "";
  const ownerName = typeof body?.ownerName === "string" ? body.ownerName : "";
  const phone = typeof body?.phone === "string" ? body.phone : "";
  const code = typeof body?.code === "string" ? body.code : "";

  const client = await getAdminPool().connect();
  try {
    const result = await createCompany(client, { companyName, ownerName, phone, code });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof DuplicatePhoneError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  } finally {
    client.release();
  }
}
