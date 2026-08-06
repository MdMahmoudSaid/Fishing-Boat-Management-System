import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { t } from "@/lib/i18n";

interface PageHeaderProps {
  title: string;
  // Destination explicite plutôt que l'historique du navigateur : prévisible
  // même si la page a été ouverte directement via une URL.
  backHref: string;
  action?: React.ReactNode;
}

// En-tête commun à toutes les pages internes : flèche retour + titre.
// La flèche pointe vers la DROITE en RTL (arabe) — "retour" (vers le début
// de la lecture) est visuellement à droite, l'inverse de la convention LTR
// (←). `ltr:rotate-180` retourne le glyphe automatiquement en français
// (LTR) : le sens du texte se retourne via `dir` sur <html>, mais le glyphe
// SVG lui-même ne suit pas ça tout seul.
export function PageHeader({ title, backHref, action }: PageHeaderProps) {
  return (
    <header className="sticky top-0 z-10 -mx-6 mb-6 flex items-center gap-3 border-b border-sand-dim bg-sand/90 px-6 py-4 backdrop-blur-sm dark:border-white/10 dark:bg-ink/90 print:static print:border-b-0 print:bg-white print:px-0 print:backdrop-blur-none">
      <Link
        href={backHref}
        aria-label={t("common.back")}
        className="-ms-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-sand-dim hover:text-ink dark:text-sand/70 dark:hover:bg-white/10 dark:hover:text-sand print:hidden"
      >
        <ChevronRight size={20} className="ltr:rotate-180" />
      </Link>
      <h1 className="font-display flex-1 truncate text-lg font-semibold text-ink dark:text-sand">
        {title}
      </h1>
      {action && <div className="print:hidden">{action}</div>}
    </header>
  );
}
