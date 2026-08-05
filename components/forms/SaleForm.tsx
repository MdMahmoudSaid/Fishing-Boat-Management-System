"use client";

import { FormEvent, useState } from "react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { t } from "@/lib/i18n";
import type { SaleInput } from "@/lib/db/sales";

export interface StockOption {
  fishCategoryId: string;
  fishQualityLevelId: string;
  label: string;
  unit: string;
  remainingQuantity: number;
}

interface SaleFormProps {
  buyers: { id: string; name: string }[];
  stockOptions: StockOption[];
  onSubmit: (input: SaleInput) => Promise<void>;
  onCancel: () => void;
}

const TODAY = new Date().toISOString().slice(0, 10);

function optionKey(o: { fishCategoryId: string; fishQualityLevelId: string }): string {
  return `${o.fishCategoryId}:${o.fishQualityLevelId}`;
}

export function SaleForm({ buyers, stockOptions, onSubmit, onCancel }: SaleFormProps) {
  const [buyerId, setBuyerId] = useState(buyers[0]?.id ?? "");
  const [stockKey, setStockKey] = useState(
    stockOptions[0] ? optionKey(stockOptions[0]) : "",
  );
  const [quantity, setQuantity] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [date, setDate] = useState(TODAY);
  const [submitting, setSubmitting] = useState(false);

  const selectedStock = stockOptions.find((o) => optionKey(o) === stockKey);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!selectedStock) return;
    setSubmitting(true);
    try {
      await onSubmit({
        buyerId,
        fishCategoryId: selectedStock.fishCategoryId,
        fishQualityLevelId: selectedStock.fishQualityLevelId,
        quantity: Number(quantity),
        salePrice: Number(salePrice),
        date,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Select
        label={t("sales.buyer")}
        value={buyerId}
        onChange={(e) => setBuyerId(e.target.value)}
        options={buyers.map((b) => ({ value: b.id, label: b.name }))}
        required
      />
      <Select
        label={t("sales.remainingStock")}
        value={stockKey}
        onChange={(e) => setStockKey(e.target.value)}
        options={stockOptions.map((o) => ({ value: optionKey(o), label: o.label }))}
        required
      />
      <Input
        label={`${t("sales.quantity")} (${selectedStock?.unit ?? ""})`}
        type="number"
        min="0.01"
        max={selectedStock?.remainingQuantity}
        step="0.01"
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
        required
        dir="ltr"
      />
      <Input
        label={t("sales.salePrice")}
        type="number"
        min="0.01"
        step="0.01"
        value={salePrice}
        onChange={(e) => setSalePrice(e.target.value)}
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
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" disabled={submitting || !selectedStock}>
          {t("common.save")}
        </Button>
      </div>
    </form>
  );
}
