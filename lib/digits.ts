// Convertit les chiffres indo-arabes (٠-٩) et leur variante persane
// (۰-۹) en chiffres latins. Nécessaire car un clavier système en disposition
// arabe produit ces caractères sur les touches numériques du haut du
// clavier — sans cette conversion, `.replace(/\D/g, "")` (qui ne reconnaît
// que 0-9 ASCII) les élimine silencieusement, rendant PhoneInput/CodeInput
// impossibles à remplir au clavier (le collage fonctionne, lui, car le
// texte collé contient déjà des chiffres latins dans la plupart des cas).
const ARABIC_INDIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

export function toLatinDigits(input: string): string {
  return input.replace(/[٠-٩۰-۹]/g, (char) => {
    const arabicIndicIndex = ARABIC_INDIC_DIGITS.indexOf(char);
    if (arabicIndicIndex !== -1) return String(arabicIndicIndex);
    return String(PERSIAN_DIGITS.indexOf(char));
  });
}
