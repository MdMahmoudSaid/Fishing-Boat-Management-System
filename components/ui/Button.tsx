import { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";

const variantClasses: Record<Variant, string> = {
  primary: "bg-rope text-white shadow-sm shadow-rope/20 hover:bg-rope-dark active:bg-rope-dark",
  secondary:
    "bg-white text-ink ring-1 ring-inset ring-sand-dim hover:bg-sand dark:bg-white/5 dark:text-sand dark:ring-white/10 dark:hover:bg-white/10",
  danger: "bg-danger text-white shadow-sm shadow-danger/20 hover:bg-danger/90",
  ghost: "bg-transparent text-ink-soft hover:bg-sand-dim dark:text-sand/70 dark:hover:bg-white/10",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${variantClasses[variant]} ${className}`}
      {...props}
    />
  );
}
