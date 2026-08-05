"use client";

import { FormEvent, useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { t } from "@/lib/i18n";
import type { BuyerInput } from "@/lib/db/buyers";

interface BuyerFormProps {
  initial?: BuyerInput;
  onSubmit: (input: BuyerInput) => Promise<void>;
  onCancel: () => void;
}

export function BuyerForm({ initial, onSubmit, onCancel }: BuyerFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({ name, phone: phone || null, notes: notes || null });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        label={t("buyers.name")}
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <Input
        label={t("buyers.phone")}
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        dir="ltr"
      />
      <Input
        label={t("buyers.notes")}
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
