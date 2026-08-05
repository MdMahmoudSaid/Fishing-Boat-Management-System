"use client";

import { FormEvent, useMemo, useState } from "react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { t } from "@/lib/i18n";
import type { CatchInput } from "@/lib/db/catches";

interface FishCategoryOption {
  id: string;
  name: string;
  defaultUnit: string;
}

interface FishQualityLevelOption {
  id: string;
  fishCategoryId: string;
  name: string;
}

interface CatchFormProps {
  categories: FishCategoryOption[];
  qualityLevels: FishQualityLevelOption[];
  onSubmit: (input: CatchInput) => Promise<void>;
  onCancel: () => void;
}

export function CatchForm({
  categories,
  qualityLevels,
  onSubmit,
  onCancel,
}: CatchFormProps) {
  const [fishCategoryId, setFishCategoryId] = useState(categories[0]?.id ?? "");

  const availableQualityLevels = useMemo(
    () => qualityLevels.filter((q) => q.fishCategoryId === fishCategoryId),
    [qualityLevels, fishCategoryId],
  );

  const [fishQualityLevelId, setFishQualityLevelId] = useState(
    availableQualityLevels[0]?.id ?? "",
  );
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState(categories[0]?.defaultUnit ?? "");
  const [estimatedPrice, setEstimatedPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function handleCategoryChange(newCategoryId: string) {
    setFishCategoryId(newCategoryId);
    const category = categories.find((c) => c.id === newCategoryId);
    setUnit(category?.defaultUnit ?? "");
    const firstQuality = qualityLevels.find((q) => q.fishCategoryId === newCategoryId);
    setFishQualityLevelId(firstQuality?.id ?? "");
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({
        fishCategoryId,
        fishQualityLevelId,
        quantity: Number(quantity),
        unit,
        estimatedPrice: estimatedPrice ? Number(estimatedPrice) : null,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Select
        label={t("catches.fishCategory")}
        value={fishCategoryId}
        onChange={(e) => handleCategoryChange(e.target.value)}
        options={categories.map((c) => ({ value: c.id, label: c.name }))}
        required
      />
      <Select
        label={t("catches.fishQualityLevel")}
        value={fishQualityLevelId}
        onChange={(e) => setFishQualityLevelId(e.target.value)}
        options={availableQualityLevels.map((q) => ({ value: q.id, label: q.name }))}
        required
        disabled={availableQualityLevels.length === 0}
      />
      <Input
        label={t("catches.quantity")}
        type="number"
        min="0.01"
        step="0.01"
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
        required
        dir="ltr"
      />
      <Input
        label={t("catches.unit")}
        value={unit}
        onChange={(e) => setUnit(e.target.value)}
        required
        dir="ltr"
      />
      <Input
        label={t("catches.estimatedPrice")}
        type="number"
        min="0"
        step="0.01"
        value={estimatedPrice}
        onChange={(e) => setEstimatedPrice(e.target.value)}
        dir="ltr"
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        <Button
          type="submit"
          disabled={submitting || !fishCategoryId || !fishQualityLevelId}
        >
          {t("common.save")}
        </Button>
      </div>
    </form>
  );
}
