import type { AbstractPowerSyncDatabase } from "@powersync/web";
import { generateId } from "@/lib/id/generateId";

export interface FishCategoryInput {
  name: string;
  defaultUnit: string;
  notes?: string | null;
}

export async function createFishCategory(
  db: AbstractPowerSyncDatabase,
  companyId: string,
  input: FishCategoryInput,
): Promise<void> {
  await db.execute(
    `INSERT INTO fish_categories (id, company_id, name, default_unit, notes, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    [
      generateId(),
      companyId,
      input.name,
      input.defaultUnit,
      input.notes ?? null,
      new Date().toISOString(),
    ],
  );
}

export async function updateFishCategory(
  db: AbstractPowerSyncDatabase,
  id: string,
  input: FishCategoryInput,
): Promise<void> {
  await db.execute(
    `UPDATE fish_categories SET name = ?, default_unit = ?, notes = ? WHERE id = ?`,
    [input.name, input.defaultUnit, input.notes ?? null, id],
  );
}

// Soft delete uniquement : les catches existants référencent cette catégorie.
export async function softDeleteFishCategory(
  db: AbstractPowerSyncDatabase,
  id: string,
): Promise<void> {
  await db.execute(`UPDATE fish_categories SET deleted_at = ? WHERE id = ?`, [
    new Date().toISOString(),
    id,
  ]);
}
