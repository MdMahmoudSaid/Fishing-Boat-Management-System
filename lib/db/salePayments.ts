import type { AbstractPowerSyncDatabase } from "@powersync/web";
import { generateId } from "@/lib/id/generateId";

export interface SalePaymentInput {
  amount: number;
  date: string;
  notes?: string | null;
}

// Supporte paiement total, partiel ou différé (§14) : plusieurs lignes
// peuvent être ajoutées pour une même vente.
export async function createSalePayment(
  db: AbstractPowerSyncDatabase,
  companyId: string,
  saleId: string,
  input: SalePaymentInput,
): Promise<void> {
  await db.execute(
    `INSERT INTO sale_payments (id, company_id, sale_id, amount, date, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      generateId(),
      companyId,
      saleId,
      input.amount,
      input.date,
      input.notes ?? null,
      new Date().toISOString(),
    ],
  );
}
