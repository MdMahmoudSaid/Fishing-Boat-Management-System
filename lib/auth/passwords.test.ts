import { describe, expect, it } from "vitest";
import { hashLoginCode, verifyLoginCode } from "./passwords";

describe("hashLoginCode / verifyLoginCode", () => {
  it("un hash vérifie correctement le code d'origine", async () => {
    const hash = await hashLoginCode("1234");
    expect(await verifyLoginCode("1234", hash)).toBe(true);
  });

  it("rejette un code différent", async () => {
    const hash = await hashLoginCode("1234");
    expect(await verifyLoginCode("9999", hash)).toBe(false);
  });

  it("produit un hash différent de la valeur en clair", async () => {
    const hash = await hashLoginCode("1234");
    expect(hash).not.toBe("1234");
  });
});
