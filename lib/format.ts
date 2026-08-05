// Formatage monétaire centralisé (§8 du PROJECT_PLAN : suffixe "MRU",
// arrondi standard à 2 décimales, partout dans l'app).
//
// Isolat bidi (LRI...PDI) : sans ça, "0.00 MRU" affiché dans un contexte RTL
// peut se réordonner visuellement en "MRU 0.00" (le nombre et les lettres
// latines sont des runs bidi distincts que l'algorithme peut permuter entre
// eux dans un paragraphe RTL). L'isolat garantit un rendu LTR correct partout,
// sans dépendre d'un `dir="ltr"` posé à chaque endroit d'affichage.
const LRI = "⁦";
const PDI = "⁩";

export function formatCurrency(amount: number): string {
  const rounded = amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${LRI}${rounded} MRU${PDI}`;
}
