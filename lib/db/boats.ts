import type { AbstractPowerSyncDatabase } from "@powersync/web";
import { generateId } from "@/lib/id/generateId";

export type BoatStatus = "active" | "maintenance" | "in_trip";

export interface BoatInput {
  name: string;
  registrationNumber?: string | null;
  captainName?: string | null;
  notes?: string | null;
  status: BoatStatus;
}

export async function createBoat(
  db: AbstractPowerSyncDatabase,
  companyId: string,
  input: BoatInput,
): Promise<void> {
  const now = new Date().toISOString();
  await db.execute(
    `INSERT INTO boats (id, company_id, name, registration_number, captain_name, notes, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      generateId(),
      companyId,
      input.name,
      input.registrationNumber ?? null,
      input.captainName ?? null,
      input.notes ?? null,
      input.status,
      now,
      now,
    ],
  );
}

export async function updateBoat(
  db: AbstractPowerSyncDatabase,
  id: string,
  input: BoatInput,
): Promise<void> {
  await db.execute(
    `UPDATE boats SET name = ?, registration_number = ?, captain_name = ?, notes = ?, status = ?, updated_at = ?
     WHERE id = ?`,
    [
      input.name,
      input.registrationNumber ?? null,
      input.captainName ?? null,
      input.notes ?? null,
      input.status,
      new Date().toISOString(),
      id,
    ],
  );
}

// Utilisé par la Phase 3 pour refléter l'état physique du bateau, découplé
// du statut administratif du trip (voir docs/PROJECT_PHASES.md, Phase 3).
export async function setBoatStatus(
  db: AbstractPowerSyncDatabase,
  id: string,
  status: BoatStatus,
): Promise<void> {
  await db.execute(`UPDATE boats SET status = ?, updated_at = ? WHERE id = ?`, [
    status,
    new Date().toISOString(),
    id,
  ]);
}

// Soft delete uniquement : l'historique des trips doit rester intact (§7).
export async function softDeleteBoat(
  db: AbstractPowerSyncDatabase,
  id: string,
): Promise<void> {
  await db.execute(`UPDATE boats SET deleted_at = ? WHERE id = ?`, [
    new Date().toISOString(),
    id,
  ]);
}
