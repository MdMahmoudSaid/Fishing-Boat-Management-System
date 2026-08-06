import type { AbstractPowerSyncDatabase } from "@powersync/web";
import type { Locale } from "@/lib/i18n";

export type CrewPaymentMethod = "percentage_gross" | "percentage_after_expenses";

export async function updateDefaultCrewPaymentMethod(
  db: AbstractPowerSyncDatabase,
  companyId: string,
  method: CrewPaymentMethod,
): Promise<void> {
  await db.execute(
    `UPDATE settings SET default_crew_payment_method = ? WHERE company_id = ?`,
    [method, companyId],
  );
}

export async function updateLanguage(
  db: AbstractPowerSyncDatabase,
  companyId: string,
  language: Locale,
): Promise<void> {
  await db.execute(`UPDATE settings SET language = ? WHERE company_id = ?`, [
    language,
    companyId,
  ]);
}
