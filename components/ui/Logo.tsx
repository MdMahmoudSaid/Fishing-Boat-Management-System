import { t } from "@/lib/i18n";

interface LogoProps {
  size?: number;
  withWordmark?: boolean;
  className?: string;
}

// Marque de l'app : voilier + vague, tracé mono-ligne. Utilisée sur la page
// de connexion et dans l'en-tête (voir PageHeader). Volontairement simple
// pour rester lisible à petite taille (barre d'en-tête mobile).
export function Logo({ size = 40, withWordmark = false, className = "" }: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span
        className="inline-flex shrink-0 items-center justify-center rounded-2xl bg-ink text-sand"
        style={{ width: size, height: size }}
      >
        <svg
          viewBox="0 0 32 32"
          width={size * 0.62}
          height={size * 0.62}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M16 18V7" />
          <path d="M16 8 L23.5 11.5 L16 14Z" fill="currentColor" stroke="none" />
          <path d="M9 18H23L20 23H12Z" />
          <path d="M4 27c2.5-2.5 5-2.5 7.5 0s5 2.5 7.5 0 5-2.5 7.5 0" />
        </svg>
      </span>
      {withWordmark && (
        <span className="font-display text-lg font-semibold text-ink dark:text-sand">
          {t("app.name")}
        </span>
      )}
    </span>
  );
}
