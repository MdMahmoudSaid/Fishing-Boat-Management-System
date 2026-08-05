import type { AbstractPowerSyncDatabase } from "@powersync/web";

export async function updateCompanyName(
  db: AbstractPowerSyncDatabase,
  companyId: string,
  name: string,
): Promise<void> {
  await db.execute(`UPDATE companies SET name = ? WHERE id = ?`, [name, companyId]);
}
