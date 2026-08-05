import type { AbstractPowerSyncDatabase } from "@powersync/web";
import { generateId } from "@/lib/id/generateId";

export interface ExpenseCategoryInput {
  name: string;
}

export async function createExpenseCategory(
  db: AbstractPowerSyncDatabase,
  companyId: string,
  input: ExpenseCategoryInput,
): Promise<void> {
  await db.execute(
    `INSERT INTO expense_categories (id, company_id, name, is_default, created_at) VALUES (?, ?, ?, ?, ?)`,
    [generateId(), companyId, input.name, 0, new Date().toISOString()],
  );
}

export async function updateExpenseCategory(
  db: AbstractPowerSyncDatabase,
  id: string,
  input: ExpenseCategoryInput,
): Promise<void> {
  await db.execute(`UPDATE expense_categories SET name = ? WHERE id = ?`, [
    input.name,
    id,
  ]);
}

// Soft delete uniquement : les expenses existantes référencent cette catégorie.
export async function softDeleteExpenseCategory(
  db: AbstractPowerSyncDatabase,
  id: string,
): Promise<void> {
  await db.execute(`UPDATE expense_categories SET deleted_at = ? WHERE id = ?`, [
    new Date().toISOString(),
    id,
  ]);
}
