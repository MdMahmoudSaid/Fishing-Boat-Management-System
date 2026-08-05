import type { AbstractPowerSyncDatabase } from "@powersync/web";
import { generateId } from "@/lib/id/generateId";
import { assertQuantityWithinStock } from "@/lib/calculations/inventory";

export interface SaleInput {
  buyerId: string;
  fishCategoryId: string;
  fishQualityLevelId: string;
  quantity: number;
  salePrice: number;
  date: string;
}

interface StockRow {
  fish_category_id: string;
  fish_quality_level_id: string;
  quantity: number;
}

// Valide contre le stock restant (lecture locale uniquement, §7) avant
// d'insérer. total_amount est calculé côté client : SQLite/PowerSync ne
// supporte pas les colonnes générées comme Postgres.
export async function createSale(
  db: AbstractPowerSyncDatabase,
  companyId: string,
  tripId: string,
  input: SaleInput,
): Promise<void> {
  const catches = await db.getAll<StockRow>(
    "SELECT fish_category_id, fish_quality_level_id, quantity FROM catches WHERE trip_id = ?",
    [tripId],
  );
  const sales = await db.getAll<StockRow>(
    "SELECT fish_category_id, fish_quality_level_id, quantity FROM sales WHERE trip_id = ?",
    [tripId],
  );

  assertQuantityWithinStock(
    catches.map((c) => ({
      fishCategoryId: c.fish_category_id,
      fishQualityLevelId: c.fish_quality_level_id,
      quantity: c.quantity,
    })),
    sales.map((s) => ({
      fishCategoryId: s.fish_category_id,
      fishQualityLevelId: s.fish_quality_level_id,
      quantity: s.quantity,
    })),
    input.fishCategoryId,
    input.fishQualityLevelId,
    input.quantity,
  );

  const totalAmount = input.quantity * input.salePrice;

  await db.execute(
    `INSERT INTO sales (id, company_id, trip_id, buyer_id, fish_category_id, fish_quality_level_id, quantity, sale_price, total_amount, date, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      generateId(),
      companyId,
      tripId,
      input.buyerId,
      input.fishCategoryId,
      input.fishQualityLevelId,
      input.quantity,
      input.salePrice,
      totalAmount,
      input.date,
      new Date().toISOString(),
    ],
  );
}
