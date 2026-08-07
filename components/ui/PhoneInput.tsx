"use client";

import { InputHTMLAttributes, forwardRef } from "react";
import { COUNTRY_CODE } from "@/lib/auth/phoneAuth";

interface PhoneInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> {
  label?: string;
  error?: string;
  // Chiffres locaux uniquement (sans +222) — voir lib/auth/phoneAuth.ts.
  value: string;
  onChange: (digits: string) => void;
}

// Champ téléphone avec l'indicatif +222 fixe, non éditable, toujours affiché
// devant le champ (composant dédié plutôt qu'une prop sur Input générique,
// pour ne pas risquer de régression visuelle sur les ~15 formulaires qui
// utilisent déjà Input tel quel).
export const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ label, error, value, onChange, id, className = "", ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={id}
            className="text-sm font-medium text-ink-soft dark:text-sand/80"
          >
            {label}
          </label>
        )}
        {/* dir="ltr" sur tout le groupe : l'indicatif reste toujours avant
            les chiffres, quelle que soit la langue active (même logique que
            formatCurrency, voir lib/format.ts). */}
        <div
          dir="ltr"
          className="flex items-stretch overflow-hidden rounded-xl border border-sand-dim bg-white transition-colors focus-within:border-rope dark:border-white/10 dark:bg-white/5"
        >
          <span className="flex select-none items-center border-e border-sand-dim bg-sand-dim/50 px-3 text-sm font-medium text-ink-soft dark:border-white/10 dark:bg-white/5 dark:text-sand/70">
            {COUNTRY_CODE}
          </span>
          <input
            ref={ref}
            id={id}
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            dir="ltr"
            value={value}
            onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 8))}
            maxLength={8}
            className={`min-h-11 min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-faint dark:text-sand ${className}`}
            {...props}
          />
        </div>
        {error && <span className="text-xs text-danger">{error}</span>}
      </div>
    );
  },
);
PhoneInput.displayName = "PhoneInput";
