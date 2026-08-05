// Calcul du paiement équipage (§4.9-4.10 du PROJECT_PLAN). Deux niveaux :
// - trips.crew_payment_method : détermine, pour un membre payé au
//   pourcentage, sur QUELLE base ce pourcentage s'applique
//   ('percentage_gross' → chiffre d'affaires brut, 'percentage_after_expenses'
//   → chiffre d'affaires moins dépenses). Si le trip est en 'fixed', la base
//   par défaut retombe sur le brut (valeur sûre, jamais utilisée en pratique
//   pour un membre 'percentage' sur un trip 'fixed').
// - trip_crew.payment_type : par membre, indépendant du trip — un membre
//   'fixed' touche toujours son fixed_amount, quelle que soit la méthode du
//   trip ; un membre 'percentage' touche percentage% de la base ci-dessus.
// Fonctions pures, testables sans DB — voir crewPayment.test.ts.

export type TripCrewPaymentMethod =
  | "fixed"
  | "percentage_gross"
  | "percentage_after_expenses";

export type TripCrewMemberPaymentType = "fixed" | "percentage";

export interface CrewMemberPaymentConfig {
  paymentType: TripCrewMemberPaymentType;
  fixedAmount: number | null;
  percentage: number | null;
}

export interface TripFinancialsForCrewPayment {
  grossSales: number;
  totalExpenses: number;
}

export function computeCrewMemberPayment(
  member: CrewMemberPaymentConfig,
  tripCrewPaymentMethod: TripCrewPaymentMethod,
  financials: TripFinancialsForCrewPayment,
): number {
  if (member.paymentType === "fixed") {
    return member.fixedAmount ?? 0;
  }

  const base =
    tripCrewPaymentMethod === "percentage_after_expenses"
      ? financials.grossSales - financials.totalExpenses
      : financials.grossSales;

  return base * ((member.percentage ?? 0) / 100);
}

export function computeCrewPaymentTotal(
  members: CrewMemberPaymentConfig[],
  tripCrewPaymentMethod: TripCrewPaymentMethod,
  financials: TripFinancialsForCrewPayment,
): number {
  return members.reduce(
    (sum, member) =>
      sum + computeCrewMemberPayment(member, tripCrewPaymentMethod, financials),
    0,
  );
}
