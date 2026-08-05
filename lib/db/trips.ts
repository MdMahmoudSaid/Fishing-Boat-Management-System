import type { AbstractPowerSyncDatabase } from "@powersync/web";
import { generateId } from "@/lib/id/generateId";
import { setBoatStatus } from "@/lib/db/boats";
import {
  assertNoActiveTripForBoat,
  assertCanClose,
  nextTripStatus,
  boatStatusForTripStatus,
  type TripStatus,
} from "@/lib/calculations/tripValidation";
import {
  computeCrewMemberPayment,
  type CrewMemberPaymentConfig,
} from "@/lib/calculations/crewPayment";

export type TripCrewPaymentMethod =
  | "fixed"
  | "percentage_gross"
  | "percentage_after_expenses";

export interface TripInput {
  boatId: string;
  captainName?: string | null;
  departureDate: string;
  expectedReturnDate?: string | null;
  crewPaymentMethod: TripCrewPaymentMethod;
  notes?: string | null;
}

export interface TripEditableFields {
  captainName?: string | null;
  departureDate: string;
  expectedReturnDate?: string | null;
  crewPaymentMethod: TripCrewPaymentMethod;
  notes?: string | null;
}

interface ExistingTripRow {
  id: string;
  status: TripStatus;
}

export async function createTrip(
  db: AbstractPowerSyncDatabase,
  companyId: string,
  input: TripInput,
): Promise<string> {
  const existingTrips = await db.getAll<ExistingTripRow>(
    "SELECT id, status FROM trips WHERE boat_id = ? AND deleted_at IS NULL",
    [input.boatId],
  );
  assertNoActiveTripForBoat(existingTrips);

  const id = generateId();
  const now = new Date().toISOString();
  await db.execute(
    `INSERT INTO trips (id, company_id, boat_id, captain_name, departure_date, expected_return_date, actual_return_date, status, crew_payment_method, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, NULL, 'preparing', ?, ?, ?, ?)`,
    [
      id,
      companyId,
      input.boatId,
      input.captainName ?? null,
      input.departureDate,
      input.expectedReturnDate ?? null,
      input.crewPaymentMethod,
      input.notes ?? null,
      now,
      now,
    ],
  );
  await setBoatStatus(db, input.boatId, "in_trip");
  return id;
}

export async function updateTrip(
  db: AbstractPowerSyncDatabase,
  tripId: string,
  input: TripEditableFields,
): Promise<void> {
  await db.execute(
    `UPDATE trips SET captain_name = ?, departure_date = ?, expected_return_date = ?, crew_payment_method = ?, notes = ?, updated_at = ?
     WHERE id = ?`,
    [
      input.captainName ?? null,
      input.departureDate,
      input.expectedReturnDate ?? null,
      input.crewPaymentMethod,
      input.notes ?? null,
      new Date().toISOString(),
      tripId,
    ],
  );
}

interface TripForStatusChange {
  id: string;
  boatId: string;
  status: TripStatus;
  actualReturnDate: string | null;
  crewPaymentMethod: TripCrewPaymentMethod;
}

interface TripCrewRow extends CrewMemberPaymentConfig {
  id: string;
}

// Calcule et fige trip_crew.computed_amount pour chaque membre assigné,
// selon la méthode du trip (§6, crewPayment.ts). Appelé une seule fois, au
// moment de la clôture — les ventes/dépenses ajoutées après ne changent
// plus ce montant (§10 Definition of Done).
async function finalizeCrewPayments(
  db: AbstractPowerSyncDatabase,
  trip: TripForStatusChange,
): Promise<void> {
  const [{ gross_sales: grossSales } = { gross_sales: 0 }] = await db.getAll<{
    gross_sales: number;
  }>("SELECT COALESCE(SUM(total_amount), 0) AS gross_sales FROM sales WHERE trip_id = ?", [
    trip.id,
  ]);
  const [{ total_expenses: totalExpenses } = { total_expenses: 0 }] = await db.getAll<{
    total_expenses: number;
  }>("SELECT COALESCE(SUM(amount), 0) AS total_expenses FROM expenses WHERE trip_id = ?", [
    trip.id,
  ]);

  const crewRows = await db.getAll<TripCrewRow>(
    "SELECT id, payment_type AS paymentType, fixed_amount AS fixedAmount, percentage FROM trip_crew WHERE trip_id = ?",
    [trip.id],
  );

  for (const member of crewRows) {
    const computedAmount = computeCrewMemberPayment(member, trip.crewPaymentMethod, {
      grossSales,
      totalExpenses,
    });
    await db.execute(`UPDATE trip_crew SET computed_amount = ? WHERE id = ?`, [
      computedAmount,
      member.id,
    ]);
  }
}

// Fait progresser le trip d'un cran (preparing→at_sea→returned→closed) et
// répercute le changement sur le statut du bateau (§7, tripValidation.ts).
// `actualReturnDate` : demandé par l'UI au moment de la transition vers
// 'returned' (par défaut aujourd'hui si non fourni).
export async function advanceTripStatus(
  db: AbstractPowerSyncDatabase,
  trip: TripForStatusChange,
  options?: { actualReturnDate?: string },
): Promise<void> {
  const next = nextTripStatus(trip.status);
  if (!next) return;

  const actualReturnDate =
    next === "returned"
      ? (options?.actualReturnDate ?? new Date().toISOString().slice(0, 10))
      : trip.actualReturnDate;

  if (next === "closed") {
    assertCanClose({ actualReturnDate });
    await finalizeCrewPayments(db, trip);
  }

  await db.execute(
    `UPDATE trips SET status = ?, actual_return_date = ?, updated_at = ? WHERE id = ?`,
    [next, actualReturnDate, new Date().toISOString(), trip.id],
  );

  const boatStatus = boatStatusForTripStatus(next);
  if (boatStatus) {
    await setBoatStatus(db, trip.boatId, boatStatus);
  }
}

// Repasse un trip clôturé à 'returned' pour corriger une vente/dépense
// oubliée avant la clôture (bug remonté en test live : computed_amount figé
// avec des données incomplètes, sans aucun moyen de le corriger). Le
// paiement équipage n'est refigé qu'à la RE-clôture, avec les données à
// jour — on efface donc computed_amount pour ne pas afficher un montant
// obsolète pendant la correction. Refuse si le bateau a entretemps une
// autre sortie active (même règle que la création, §7).
export async function reopenTrip(
  db: AbstractPowerSyncDatabase,
  trip: { id: string; boatId: string; status: TripStatus },
): Promise<void> {
  if (trip.status !== "closed") return;

  const existingTrips = await db.getAll<ExistingTripRow>(
    "SELECT id, status FROM trips WHERE boat_id = ? AND deleted_at IS NULL",
    [trip.boatId],
  );
  assertNoActiveTripForBoat(existingTrips, trip.id);

  await db.execute(`UPDATE trips SET status = 'returned', updated_at = ? WHERE id = ?`, [
    new Date().toISOString(),
    trip.id,
  ]);
  await db.execute(`UPDATE trip_crew SET computed_amount = NULL WHERE trip_id = ?`, [
    trip.id,
  ]);
}

// Soft delete uniquement (§7) ; libère le bateau (redevient 'active') s'il
// était marqué comme occupé par ce trip.
export async function softDeleteTrip(
  db: AbstractPowerSyncDatabase,
  trip: { id: string; boatId: string },
): Promise<void> {
  await db.execute(`UPDATE trips SET deleted_at = ? WHERE id = ?`, [
    new Date().toISOString(),
    trip.id,
  ]);
  await setBoatStatus(db, trip.boatId, "active");
}
