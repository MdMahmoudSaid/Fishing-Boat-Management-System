"use client";

import { InputHTMLAttributes, forwardRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { t } from "@/lib/i18n";
import { toLatinDigits } from "@/lib/digits";

interface CodeInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> {
  label?: string;
  error?: string;
  // Chiffres uniquement, déjà tronqués à la longueur attendue par l'appelant
  // (voir app/(auth)/login/page.tsx).
  value: string;
  onChange: (digits: string) => void;
}

// Champ code à 4 chiffres avec bascule afficher/masquer (œil), sur le même
// principe que PhoneInput : composant dédié plutôt qu'une prop sur Input
// générique, pour ne pas risquer de régression visuelle sur les ~15 autres
// formulaires qui utilisent déjà Input tel quel.
export const CodeInput = forwardRef<HTMLInputElement, CodeInputProps>(
  ({ label, error, value, onChange, id, className = "", ...props }, ref) => {
    const [visible, setVisible] = useState(false);

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
        <div
          dir="ltr"
          className="flex items-stretch overflow-hidden rounded-xl border border-sand-dim bg-white transition-colors focus-within:border-rope dark:border-white/10 dark:bg-white/5"
        >
          <input
            ref={ref}
            id={id}
            type={visible ? "text" : "password"}
            inputMode="numeric"
            dir="ltr"
            value={value}
            onChange={(e) => onChange(toLatinDigits(e.target.value).replace(/\D/g, "").slice(0, 4))}
            className={`min-h-11 min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-faint dark:text-sand ${className}`}
            {...props}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? t("auth.hideCode") : t("auth.showCode")}
            className="flex items-center px-3 text-ink-faint transition-colors hover:text-ink-soft dark:hover:text-sand/80"
          >
            {visible ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        {error && <span className="text-xs text-danger">{error}</span>}
      </div>
    );
  },
);
CodeInput.displayName = "CodeInput";
