"use client";

import { FormEvent, useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { t } from "@/lib/i18n";
import type { SalePaymentInput } from "@/lib/db/salePayments";

interface SalePaymentFormProps {
  maxAmount?: number;
  onSubmit: (input: SalePaymentInput) => Promise<void>;
  onCancel: () => void;
}

const TODAY = new Date().toISOString().slice(0, 10);

export function SalePaymentForm({ maxAmount, onSubmit, onCancel }: SalePaymentFormProps) {
  const [amount, setAmount] = useState(maxAmount != null ? String(maxAmount) : "");
  const [date, setDate] = useState(TODAY);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({ amount: Number(amount), date, notes: notes || null });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        label={t("sales.amount")}
        type="number"
        min="0.01"
        max={maxAmount}
        step="0.01"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        required
        dir="ltr"
      />
      <Input
        label={t("sales.date")}
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        required
        dir="ltr"
      />
      <Input
        label={t("sales.notes")}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" disabled={submitting}>
          {t("common.save")}
        </Button>
      </div>
    </form>
  );
}
