import { describe, expect, it } from "vitest";
import ar from "./ar.json";
import fr from "./fr.json";

function collectPaths(obj: any, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === "string" ? [`${prefix}${k}`] : collectPaths(v, `${prefix}${k}.`),
  );
}

// Garde-fou anti-dérive : ar.json et fr.json doivent toujours exposer
// exactement les mêmes clés, sinon t() retombe silencieusement sur la clé
// brute dans la langue manquante (voir lib/i18n/index.ts).
describe("i18n key parity", () => {
  it("fr.json a exactement les mêmes clés que ar.json", () => {
    expect(collectPaths(fr).sort()).toEqual(collectPaths(ar).sort());
  });
});
