import type { AbstractPowerSyncDatabase } from "@powersync/web";
import { generateId } from "@/lib/id/generateId";

export interface CatchInput {
  fishCategoryId: string;
  fishQualityLevelId: string;
  quantity: number;
  unit: string;
  estimatedPrice?: number | null;
}

export async function createCatch(
  db: AbstractPowerSyncDatabase,
  companyId: string,
  tripId: string,
  input: CatchInput,
): Promise<void> {
  await db.execute(
    `INSERT INTO catches (id, company_id, trip_id, fish_category_id, fish_quality_level_id, quantity, unit, estimated_price, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      generateId(),
      companyId,
      tripId,
      input.fishCategoryId,
      input.fishQualityLevelId,
      input.quantity,
      input.unit,
      input.estimatedPrice ?? null,
      new Date().toISOString(),
    ],
  );
}
