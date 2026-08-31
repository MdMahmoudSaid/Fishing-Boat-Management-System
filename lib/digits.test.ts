import { describe, expect, it } from "vitest";
import { toLatinDigits } from "./digits";

describe("toLatinDigits", () => {
  it("convertit les chiffres indo-arabes en chiffres latins", () => {
    expect(toLatinDigits("٤٤٥٥٦٦٧٧")).toBe("44556677");
  });

  it("convertit les chiffres persans en chiffres latins", () => {
    expect(toLatinDigits("۴۴۵۵۶۶۷۷")).toBe("44556677");
  });

  it("laisse les chiffres latins déjà présents inchangés", () => {
    expect(toLatinDigits("44556677")).toBe("44556677");
  });

  it("laisse les caractères non numériques inchangés (filtrés séparément par l'appelant)", () => {
    expect(toLatinDigits("abc")).toBe("abc");
  });
});
