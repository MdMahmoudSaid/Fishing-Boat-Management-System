"use client";

import { ChangeEvent, FormEvent, useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { t } from "@/lib/i18n";
import type { ExpenseInput } from "@/lib/db/expenses";

interface ExpenseFormProps {
  categories: { id: string; name: string }[];
  onAddCategoryClick: () => void;
  onSubmit: (input: ExpenseInput, photo: File | null) => Promise<void>;
  onCancel: () => void;
}

const TODAY = new Date().toISOString().slice(0, 10);

export function ExpenseForm({
  categories,
  onAddCategoryClick,
  onSubmit,
  onCancel,
}: ExpenseFormProps) {
  const [expenseCategoryId, setExpenseCategoryId] = useState(categories[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(TODAY);
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    setPhoto(event.target.files?.[0] ?? null);
  }

  function clearPhoto() {
    setPhoto(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit(
        {
          expenseCategoryId,
          amount: Number(amount),
          date,
          description: description || null,
        },
        photo,
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Select
            label={t("expenses.category")}
            value={expenseCategoryId}
            onChange={(e) => setExpenseCategoryId(e.target.value)}
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
            required
          />
        </div>
        <Button type="button" variant="secondary" onClick={onAddCategoryClick}>
          {t("expenses.addCategory")}
        </Button>
      </div>
      <Input
        label={t("expenses.amount")}
        type="number"
        min="0.01"
        step="0.01"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        required
        dir="ltr"
      />
      <Input
        label={t("expenses.date")}
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        required
        dir="ltr"
      />
      <Input
        label={t("expenses.description")}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-ink-soft dark:text-sand/80">
          {t("expenses.photo")}
        </span>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handlePhotoChange}
          className="hidden"
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-1 items-center gap-2 rounded-xl border border-dashed border-sand-dim bg-white px-3 py-2.5 text-sm text-ink-soft transition-colors hover:border-rope hover:text-rope dark:border-white/15 dark:bg-white/5 dark:text-sand/80"
          >
            <Camera size={18} className="shrink-0" />
            <span className="truncate">
              {photo ? photo.name : t("expenses.choosePhoto")}
            </span>
          </button>
          {photo && (
            <button
              type="button"
              onClick={clearPhoto}
              aria-label={t("common.delete")}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-sand-dim hover:text-danger dark:hover:bg-white/10"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" disabled={submitting || !expenseCategoryId}>
          {t("common.save")}
        </Button>
      </div>
    </form>
  );
}
