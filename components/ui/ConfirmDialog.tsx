"use client";

import { Modal } from "./Modal";
import { Button } from "./Button";
import { t } from "@/lib/i18n";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  // Par défaut : "حذف" en rouge, pour l'usage historique (soft delete, §7).
  // Surchargeable pour les confirmations non destructives (ex : réouverture
  // d'une sortie) où un bouton rouge "حذف" serait trompeur.
  confirmLabel?: string;
  confirmVariant?: "danger" | "primary";
  onConfirm: () => void;
  onCancel: () => void;
}

// Utilisé pour toute suppression (boats, trips, crew, buyers, catégories...)
// — §7 exige une confirmation explicite avant chaque soft delete — et pour
// toute autre action qui mérite une confirmation explicite.
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  confirmVariant = "danger",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onCancel} title={title}>
      <p className="mb-5 text-sm text-ink-soft dark:text-sand/70">{message}</p>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        <Button variant={confirmVariant} onClick={onConfirm}>
          {confirmLabel ?? t("common.delete")}
        </Button>
      </div>
    </Modal>
  );
}
