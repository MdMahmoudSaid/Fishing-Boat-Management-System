import type { AbstractPowerSyncDatabase } from "@powersync/web";
import { generateId } from "@/lib/id/generateId";

export interface FishQualityLevelInput {
  fishCategoryId: string;
  name: string;
  defaultPrice?: number | null;
}

export async function createFishQualityLevel(
  db: AbstractPowerSyncDatabase,
  companyId: string,
  input: FishQualityLevelInput,
): Promise<void> {
  await db.execute(
    `INSERT INTO fish_quality_levels (id, company_id, fish_category_id, name, default_price, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    [
      generateId(),
      companyId,
      input.fishCategoryId,
      input.name,
      input.defaultPrice ?? null,
      new Date().toISOString(),
    ],
  );
}

export async function updateFishQualityLevel(
  db: AbstractPowerSyncDatabase,
  id: string,
  input: FishQualityLevelInput,
): Promise<void> {
  await db.execute(
    `UPDATE fish_quality_levels SET fish_category_id = ?, name = ?, default_price = ? WHERE id = ?`,
    [input.fishCategoryId, input.name, input.defaultPrice ?? null, id],
  );
}

// Soft delete uniquement : les catches/sales existants référencent cette qualité.
export async function softDeleteFishQualityLevel(
  db: AbstractPowerSyncDatabase,
  id: string,
): Promise<void> {
  await db.execute(`UPDATE fish_quality_levels SET deleted_at = ? WHERE id = ?`, [
    new Date().toISOString(),
    id,
  ]);
}
