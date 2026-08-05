"use client";

import { FormEvent, useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { t } from "@/lib/i18n";
import type { FishCategoryInput } from "@/lib/db/fishCategories";

interface FishCategoryFormProps {
  initial?: FishCategoryInput;
  onSubmit: (input: FishCategoryInput) => Promise<void>;
  onCancel: () => void;
}

export function FishCategoryForm({ initial, onSubmit, onCancel }: FishCategoryFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [defaultUnit, setDefaultUnit] = useState(initial?.defaultUnit ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({ name, defaultUnit, notes: notes || null });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        label={t("settings.name")}
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <Input
        label={t("settings.defaultUnit")}
        value={defaultUnit}
        onChange={(e) => setDefaultUnit(e.target.value)}
        required
        placeholder="kg"
        dir="ltr"
      />
      <Input
        label={t("settings.notes")}
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
