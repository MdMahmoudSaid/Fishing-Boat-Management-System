import type { AbstractPowerSyncDatabase } from "@powersync/web";
import { generateId } from "@/lib/id/generateId";
import { assertTripNotClosed, type TripStatus } from "@/lib/calculations/tripValidation";

export interface ExpenseInput {
  expenseCategoryId: string;
  amount: number;
  date: string;
  description?: string | null;
}

// trip_id est toujours requis (§7 : jamais de dépense "générale" sans sortie).
export async function createExpense(
  db: AbstractPowerSyncDatabase,
  companyId: string,
  tripId: string,
  input: ExpenseInput,
): Promise<string> {
  const [trip] = await db.getAll<{ status: TripStatus }>(
    "SELECT status FROM trips WHERE id = ?",
    [tripId],
  );
  if (trip) assertTripNotClosed(trip.status);

  const id = generateId();
  await db.execute(
    `INSERT INTO expenses (id, company_id, trip_id, expense_category_id, amount, date, description, photo_url, photo_local_status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 'none', ?)`,
    [
      id,
      companyId,
      tripId,
      input.expenseCategoryId,
      input.amount,
      input.date,
      input.description ?? null,
      new Date().toISOString(),
    ],
  );
  return id;
}
