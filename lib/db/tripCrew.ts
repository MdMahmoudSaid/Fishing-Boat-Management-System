import type { AbstractPowerSyncDatabase } from "@powersync/web";
import { generateId } from "@/lib/id/generateId";

export type TripCrewPaymentType = "fixed" | "percentage";

export interface TripCrewInput {
  crewMemberId: string;
  paymentType: TripCrewPaymentType;
  fixedAmount?: number | null;
  percentage?: number | null;
}

export async function addTripCrewMember(
  db: AbstractPowerSyncDatabase,
  companyId: string,
  tripId: string,
  input: TripCrewInput,
): Promise<void> {
  await db.execute(
    `INSERT INTO trip_crew (id, company_id, trip_id, crew_member_id, payment_type, fixed_amount, percentage, computed_amount)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`,
    [
      generateId(),
      companyId,
      tripId,
      input.crewMemberId,
      input.paymentType,
      input.paymentType === "fixed" ? (input.fixedAmount ?? null) : null,
      input.paymentType === "percentage" ? (input.percentage ?? null) : null,
    ],
  );
}

export async function updateTripCrewMember(
  db: AbstractPowerSyncDatabase,
  id: string,
  input: TripCrewInput,
): Promise<void> {
  await db.execute(
    `UPDATE trip_crew SET crew_member_id = ?, payment_type = ?, fixed_amount = ?, percentage = ? WHERE id = ?`,
    [
      input.crewMemberId,
      input.paymentType,
      input.paymentType === "fixed" ? (input.fixedAmount ?? null) : null,
      input.paymentType === "percentage" ? (input.percentage ?? null) : null,
      id,
    ],
  );
}

// Pas de soft delete ici : trip_crew est une simple table d'assignation
// (§7 exige le soft delete pour boats/trips/crew members/buyers, pas pour
// leurs assignations à une sortie).
export async function removeTripCrewMember(
  db: AbstractPowerSyncDatabase,
  id: string,
): Promise<void> {
  await db.execute(`DELETE FROM trip_crew WHERE id = ?`, [id]);
}
