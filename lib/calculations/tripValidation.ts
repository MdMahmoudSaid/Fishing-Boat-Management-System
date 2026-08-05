// Règles métier critiques de §7 du PROJECT_PLAN, isolées en fonctions pures
// (pas d'accès DB ici) pour rester facilement testables — voir
// tripValidation.test.ts. Les appelants (lib/db/trips.ts) sont responsables
// de récupérer les données nécessaires avant d'appeler ces fonctions.

export type TripStatus = "preparing" | "at_sea" | "returned" | "closed";

export const TRIP_STATUS_ORDER: TripStatus[] = [
  "preparing",
  "at_sea",
  "returned",
  "closed",
];

export class TripValidationError extends Error {}

export interface ExistingTripSummary {
  id: string;
  status: TripStatus;
}

// §7 : "A boat cannot have more than one active trip (status in preparing,
// at_sea, returned) at the same time." — donc tout statut différent de
// 'closed' compte comme actif.
export function assertNoActiveTripForBoat(
  existingTrips: ExistingTripSummary[],
  excludeTripId?: string,
): void {
  const activeTrip = existingTrips.find(
    (trip) => trip.id !== excludeTripId && trip.status !== "closed",
  );
  if (activeTrip) {
    throw new TripValidationError(
      "هذا القارب لديه بالفعل سورتية نشطة. أغلق السورتية الحالية أولاً قبل إنشاء سورتية جديدة.",
    );
  }
}

// §7 : "A trip cannot move to 'closed' status until actual_return_date is set."
export function assertCanClose(trip: { actualReturnDate: string | null }): void {
  if (!trip.actualReturnDate) {
    throw new TripValidationError(
      "لا يمكن إغلاق السورتية قبل تسجيل تاريخ العودة الفعلي.",
    );
  }
}

// Statut suivant dans la progression preparing → at_sea → returned → closed.
// Retourne null si déjà au dernier statut (closed).
export function nextTripStatus(current: TripStatus): TripStatus | null {
  const index = TRIP_STATUS_ORDER.indexOf(current);
  if (index === -1 || index === TRIP_STATUS_ORDER.length - 1) return null;
  return TRIP_STATUS_ORDER[index + 1] ?? null;
}

// Statut du bateau dérivé du statut du trip (découplé, voir
// docs/PROJECT_PHASES.md Phase 3) : in_trip pendant preparing/at_sea,
// active dès returned (le bateau est physiquement au port).
export function boatStatusForTripStatus(
  tripStatus: TripStatus,
): "in_trip" | "active" | null {
  if (tripStatus === "preparing" || tripStatus === "at_sea") return "in_trip";
  if (tripStatus === "returned") return "active";
  return null; // 'closed' : le bateau est déjà 'active' depuis 'returned', rien à changer
}
