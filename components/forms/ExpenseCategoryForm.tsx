"use client";

import { FormEvent, useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { t } from "@/lib/i18n";
import type { ExpenseCategoryInput } from "@/lib/db/expenseCategories";

interface ExpenseCategoryFormProps {
  initial?: ExpenseCategoryInput;
  onSubmit: (input: ExpenseCategoryInput) => Promise<void>;
  onCancel: () => void;
}

export function ExpenseCategoryForm({
  initial,
  onSubmit,
  onCancel,
}: ExpenseCategoryFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({ name });
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
