"use client";

import { ReactNode } from "react";
import { X } from "lucide-react";
import { t } from "@/lib/i18n";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

export function Modal({ open, onClose, title, children }: ModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 backdrop-blur-[2px] p-0 sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-foam p-5 shadow-xl sm:rounded-2xl dark:bg-[#101a2e]"
      >
        <div className="mb-4 flex items-center justify-between">
          {title && (
            <h2 className="font-display text-lg font-semibold text-ink dark:text-sand">
              {title}
            </h2>
          )}
          <button
            onClick={onClose}
            aria-label={t("common.close")}
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-sand-dim hover:text-ink dark:hover:bg-white/10 dark:hover:text-sand"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
