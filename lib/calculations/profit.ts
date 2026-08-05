// Profit net d'une sortie (§4 du PROJECT_PLAN) :
// gross sales − total expenses − crew payment total.
// Fonction pure — les montants doivent être calculés/agrégés en amont
// (sales, expenses, crewPayment.ts) puis passés ici.

export interface TripFinancials {
  grossSales: number;
  totalExpenses: number;
  crewPaymentTotal: number;
}

export function computeTripProfit(financials: TripFinancials): number {
  return financials.grossSales - financials.totalExpenses - financials.crewPaymentTotal;
}
