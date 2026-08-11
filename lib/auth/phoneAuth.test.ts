import { describe, expect, it } from "vitest";
import { isValidLoginCode, isValidMauritanianPhone } from "./phoneAuth";

describe("isValidMauritanianPhone", () => {
  it("accepte les préfixes Chinguitel/Mattel/Mauritel", () => {
    expect(isValidMauritanianPhone("23112233")).toBe(true);
    expect(isValidMauritanianPhone("33112233")).toBe(true);
    expect(isValidMauritanianPhone("44112233")).toBe(true);
  });

  it("rejette un préfixe inconnu", () => {
    expect(isValidMauritanianPhone("13112233")).toBe(false);
  });

  it("rejette une longueur incorrecte", () => {
    expect(isValidMauritanianPhone("3311223")).toBe(false);
    expect(isValidMauritanianPhone("331122334")).toBe(false);
  });
});

describe("isValidLoginCode", () => {
  it("accepte exactement 4 chiffres", () => {
    expect(isValidLoginCode("1234")).toBe(true);
  });

  it("rejette une longueur ou un contenu incorrect", () => {
    expect(isValidLoginCode("123")).toBe(false);
    expect(isValidLoginCode("12a4")).toBe(false);
  });
});
