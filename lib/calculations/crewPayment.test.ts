import { describe, expect, it } from "vitest";
import { computeCrewMemberPayment, computeCrewPaymentTotal } from "./crewPayment";

const FINANCIALS = { grossSales: 10000, totalExpenses: 2000 };

describe("computeCrewMemberPayment", () => {
  it("fixed method / fixed member: pays the fixed amount regardless of financials", () => {
    const amount = computeCrewMemberPayment(
      { paymentType: "fixed", fixedAmount: 1500, percentage: null },
      "fixed",
      FINANCIALS,
    );
    expect(amount).toBe(1500);
  });

  it("percentage_gross method / percentage member: percentage of gross sales", () => {
    const amount = computeCrewMemberPayment(
      { paymentType: "percentage", fixedAmount: null, percentage: 20 },
      "percentage_gross",
      FINANCIALS,
    );
    expect(amount).toBe(2000); // 20% of 10000
  });

  it("percentage_after_expenses method / percentage member: percentage of (gross - expenses)", () => {
    const amount = computeCrewMemberPayment(
      { paymentType: "percentage", fixedAmount: null, percentage: 20 },
      "percentage_after_expenses",
      FINANCIALS,
    );
    expect(amount).toBe(1600); // 20% of (10000 - 2000)
  });

  it("a fixed-type member is unaffected by the trip's percentage method", () => {
    const amount = computeCrewMemberPayment(
      { paymentType: "fixed", fixedAmount: 800, percentage: null },
      "percentage_after_expenses",
      FINANCIALS,
    );
    expect(amount).toBe(800);
  });

  it("treats a missing percentage as 0", () => {
    const amount = computeCrewMemberPayment(
      { paymentType: "percentage", fixedAmount: null, percentage: null },
      "percentage_gross",
      FINANCIALS,
    );
    expect(amount).toBe(0);
  });
});

describe("computeCrewPaymentTotal", () => {
  it("sums a mix of fixed and percentage members on the same trip", () => {
    const total = computeCrewPaymentTotal(
      [
        { paymentType: "fixed", fixedAmount: 1000, percentage: null },
        { paymentType: "percentage", fixedAmount: null, percentage: 10 },
        { paymentType: "percentage", fixedAmount: null, percentage: 15 },
      ],
      "percentage_gross",
      FINANCIALS,
    );
    // 1000 (fixed) + 10% of 10000 (1000) + 15% of 10000 (1500) = 3500
    expect(total).toBe(3500);
  });

  it("returns 0 for a trip with no assigned crew", () => {
    expect(computeCrewPaymentTotal([], "percentage_gross", FINANCIALS)).toBe(0);
  });
});
