import type { AbstractPowerSyncDatabase } from "@powersync/web";
import { generateId } from "@/lib/id/generateId";

export interface BuyerInput {
  name: string;
  phone?: string | null;
  notes?: string | null;
}

export async function createBuyer(
  db: AbstractPowerSyncDatabase,
  companyId: string,
  input: BuyerInput,
): Promise<void> {
  await db.execute(
    `INSERT INTO buyers (id, company_id, name, phone, notes, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    [
      generateId(),
      companyId,
      input.name,
      input.phone ?? null,
      input.notes ?? null,
      new Date().toISOString(),
    ],
  );
}

export async function updateBuyer(
  db: AbstractPowerSyncDatabase,
  id: string,
  input: BuyerInput,
): Promise<void> {
  await db.execute(`UPDATE buyers SET name = ?, phone = ?, notes = ? WHERE id = ?`, [
    input.name,
    input.phone ?? null,
    input.notes ?? null,
    id,
  ]);
}

export async function softDeleteBuyer(
  db: AbstractPowerSyncDatabase,
  id: string,
): Promise<void> {
  await db.execute(`UPDATE buyers SET deleted_at = ? WHERE id = ?`, [
    new Date().toISOString(),
    id,
  ]);
}
