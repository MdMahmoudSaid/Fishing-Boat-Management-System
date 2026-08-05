import { describe, expect, it } from "vitest";
import { computeTripProfit } from "./profit";

describe("computeTripProfit", () => {
  it("subtracts expenses and crew payments from gross sales", () => {
    const profit = computeTripProfit({
      grossSales: 10000,
      totalExpenses: 2000,
      crewPaymentTotal: 3000,
    });
    expect(profit).toBe(5000);
  });

  it("can be negative when costs exceed revenue", () => {
    const profit = computeTripProfit({
      grossSales: 1000,
      totalExpenses: 800,
      crewPaymentTotal: 500,
    });
    expect(profit).toBe(-300);
  });

  it("equals gross sales when there are no costs", () => {
    const profit = computeTripProfit({
      grossSales: 500,
      totalExpenses: 0,
      crewPaymentTotal: 0,
    });
    expect(profit).toBe(500);
  });
});
