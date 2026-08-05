import { HTMLAttributes } from "react";

export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-2xl border border-sand-dim bg-foam p-4 shadow-[0_1px_2px_rgba(11,18,32,0.04)] transition-shadow dark:border-white/10 dark:bg-white/5 ${className}`}
      {...props}
    />
  );
}
