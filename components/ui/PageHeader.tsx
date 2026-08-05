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
// La flèche pointe vers la DROITE — en RTL, "retour" (vers le début de la
// lecture) est visuellement à droite, l'inverse de la convention LTR (←).
export function PageHeader({ title, backHref, action }: PageHeaderProps) {
  return (
    <header className="sticky top-0 z-10 -mx-6 mb-6 flex items-center gap-3 border-b border-sand-dim bg-sand/90 px-6 py-4 backdrop-blur-sm dark:border-white/10 dark:bg-ink/90">
      <Link
        href={backHref}
        aria-label={t("common.back")}
        className="-ms-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-sand-dim hover:text-ink dark:text-sand/70 dark:hover:bg-white/10 dark:hover:text-sand"
      >
        <ChevronRight size={20} />
      </Link>
      <h1 className="font-display flex-1 truncate text-lg font-semibold text-ink dark:text-sand">
        {title}
      </h1>
      {action}
    </header>
  );
}
