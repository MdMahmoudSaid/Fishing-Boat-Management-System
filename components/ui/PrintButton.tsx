"use client";

import { Printer } from "lucide-react";
import { t } from "@/lib/i18n";

// Bouton générique pour les pages de rapports : ouvre la boîte de dialogue
// d'impression du navigateur, avec la mise en page nettoyée par les règles
// print: (voir PageHeader). L'utilisateur choisit "Enregistrer en PDF"
// comme imprimante pour obtenir un fichier — pas de génération PDF côté
// client (pas de police arabe à embarquer, rendu RTL garanti identique à
// l'écran, fonctionne hors-ligne).
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      aria-label={t("common.printPdf")}
      title={t("common.printPdf")}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-sand-dim hover:text-ink dark:text-sand/70 dark:hover:bg-white/10 dark:hover:text-sand"
    >
      <Printer size={18} />
    </button>
  );
}
