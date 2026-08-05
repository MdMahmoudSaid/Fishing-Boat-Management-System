import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = "", id, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={id} className="text-sm font-medium text-ink-soft dark:text-sand/80">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={`min-h-11 rounded-xl border border-sand-dim bg-white px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-rope dark:border-white/10 dark:bg-white/5 dark:text-sand ${className}`}
          {...props}
        />
        {error && <span className="text-xs text-danger">{error}</span>}
      </div>
    );
  },
);
Input.displayName = "Input";
