import type { AbstractPowerSyncDatabase } from "@powersync/web";
import { generateId } from "@/lib/id/generateId";

export interface CrewMemberInput {
  name: string;
  phone?: string | null;
  notes?: string | null;
}

export async function createCrewMember(
  db: AbstractPowerSyncDatabase,
  companyId: string,
  input: CrewMemberInput,
): Promise<void> {
  await db.execute(
    `INSERT INTO crew_members (id, company_id, name, phone, notes, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
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

export async function updateCrewMember(
  db: AbstractPowerSyncDatabase,
  id: string,
  input: CrewMemberInput,
): Promise<void> {
  await db.execute(`UPDATE crew_members SET name = ?, phone = ?, notes = ? WHERE id = ?`, [
    input.name,
    input.phone ?? null,
    input.notes ?? null,
    id,
  ]);
}

export async function softDeleteCrewMember(
  db: AbstractPowerSyncDatabase,
  id: string,
): Promise<void> {
  await db.execute(`UPDATE crew_members SET deleted_at = ? WHERE id = ?`, [
    new Date().toISOString(),
    id,
  ]);
}
