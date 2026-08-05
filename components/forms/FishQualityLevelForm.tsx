"use client";

import { FormEvent, useState } from "react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { t } from "@/lib/i18n";
import type { FishQualityLevelInput } from "@/lib/db/fishQualityLevels";

interface FishQualityLevelFormProps {
  categories: { id: string; name: string }[];
  initial?: FishQualityLevelInput;
  onSubmit: (input: FishQualityLevelInput) => Promise<void>;
  onCancel: () => void;
}

export function FishQualityLevelForm({
  categories,
  initial,
  onSubmit,
  onCancel,
}: FishQualityLevelFormProps) {
  const [fishCategoryId, setFishCategoryId] = useState(
    initial?.fishCategoryId ?? categories[0]?.id ?? "",
  );
  const [name, setName] = useState(initial?.name ?? "");
  const [defaultPrice, setDefaultPrice] = useState(
    initial?.defaultPrice != null ? String(initial.defaultPrice) : "",
  );
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({
        fishCategoryId,
        name,
        defaultPrice: defaultPrice ? Number(defaultPrice) : null,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Select
        label={t("settings.fishCategory")}
        value={fishCategoryId}
        onChange={(e) => setFishCategoryId(e.target.value)}
        options={categories.map((c) => ({ value: c.id, label: c.name }))}
        required
      />
      <Input
        label={t("settings.name")}
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <Input
        label={t("settings.defaultPrice")}
        type="number"
        min="0"
        step="0.01"
        value={defaultPrice}
        onChange={(e) => setDefaultPrice(e.target.value)}
        dir="ltr"
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
