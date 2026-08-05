import { describe, expect, it } from "vitest";
import {
  computeRemainingStock,
  remainingStockFor,
  assertQuantityWithinStock,
  InsufficientStockError,
} from "./inventory";

const SARDINE = "fish-sardine";
const GRADE_A = "quality-grade-a";
const TUNA = "fish-tuna";
const GRADE_B = "quality-grade-b";

describe("computeRemainingStock", () => {
  it("sums multiple catches and sales per fish+quality group", () => {
    const result = computeRemainingStock(
      [
        { fishCategoryId: SARDINE, fishQualityLevelId: GRADE_A, quantity: 100 },
        { fishCategoryId: SARDINE, fishQualityLevelId: GRADE_A, quantity: 50 },
        { fishCategoryId: TUNA, fishQualityLevelId: GRADE_B, quantity: 30 },
      ],
      [
        { fishCategoryId: SARDINE, fishQualityLevelId: GRADE_A, quantity: 40 },
        { fishCategoryId: SARDINE, fishQualityLevelId: GRADE_A, quantity: 10 },
      ],
    );

    const sardine = result.find((g) => g.fishCategoryId === SARDINE);
    expect(sardine).toEqual({
      fishCategoryId: SARDINE,
      fishQualityLevelId: GRADE_A,
      caughtQuantity: 150,
      soldQuantity: 50,
      remainingQuantity: 100,
    });

    const tuna = result.find((g) => g.fishCategoryId === TUNA);
    expect(tuna).toEqual({
      fishCategoryId: TUNA,
      fishQualityLevelId: GRADE_B,
      caughtQuantity: 30,
      soldQuantity: 0,
      remainingQuantity: 30,
    });
  });

  it("does not mix different fish/quality groups", () => {
    const result = computeRemainingStock(
      [
        { fishCategoryId: SARDINE, fishQualityLevelId: GRADE_A, quantity: 100 },
        { fishCategoryId: SARDINE, fishQualityLevelId: GRADE_B, quantity: 20 },
      ],
      [{ fishCategoryId: SARDINE, fishQualityLevelId: GRADE_B, quantity: 5 }],
    );

    expect(remainingStockFor([], [], SARDINE, GRADE_A)).toBe(0);
    expect(
      result.find((g) => g.fishQualityLevelId === GRADE_A)?.remainingQuantity,
    ).toBe(100);
    expect(
      result.find((g) => g.fishQualityLevelId === GRADE_B)?.remainingQuantity,
    ).toBe(15);
  });
});

describe("remainingStockFor", () => {
  it("returns 0 for a group with no catches", () => {
    expect(remainingStockFor([], [], SARDINE, GRADE_A)).toBe(0);
  });

  it("returns 0 when everything caught has been sold", () => {
    const catches = [
      { fishCategoryId: SARDINE, fishQualityLevelId: GRADE_A, quantity: 100 },
    ];
    const sales = [
      { fishCategoryId: SARDINE, fishQualityLevelId: GRADE_A, quantity: 100 },
    ];
    expect(remainingStockFor(catches, sales, SARDINE, GRADE_A)).toBe(0);
  });
});

describe("assertQuantityWithinStock", () => {
  const catches = [
    { fishCategoryId: SARDINE, fishQualityLevelId: GRADE_A, quantity: 100 },
  ];

  it("does not throw when the requested quantity is within stock", () => {
    expect(() =>
      assertQuantityWithinStock(catches, [], SARDINE, GRADE_A, 100),
    ).not.toThrow();
  });

  it("throws InsufficientStockError when the requested quantity exceeds stock", () => {
    expect(() =>
      assertQuantityWithinStock(catches, [], SARDINE, GRADE_A, 100.01),
    ).toThrow(InsufficientStockError);
  });

  it("throws when stock is already fully depleted", () => {
    const sales = [
      { fishCategoryId: SARDINE, fishQualityLevelId: GRADE_A, quantity: 100 },
    ];
    expect(() =>
      assertQuantityWithinStock(catches, sales, SARDINE, GRADE_A, 1),
    ).toThrow(InsufficientStockError);
  });
});
