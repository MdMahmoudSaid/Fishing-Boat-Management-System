"use client";

import { FormEvent, useState } from "react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { t } from "@/lib/i18n";
import type { TripCrewInput, TripCrewPaymentType } from "@/lib/db/tripCrew";

interface TripCrewAssignmentFormProps {
  crewMembers: { id: string; name: string }[];
  initial?: TripCrewInput;
  onSubmit: (input: TripCrewInput) => Promise<void>;
  onCancel: () => void;
}

export function TripCrewAssignmentForm({
  crewMembers,
  initial,
  onSubmit,
  onCancel,
}: TripCrewAssignmentFormProps) {
  const [crewMemberId, setCrewMemberId] = useState(
    initial?.crewMemberId ?? crewMembers[0]?.id ?? "",
  );
  const [paymentType, setPaymentType] = useState<TripCrewPaymentType>(
    initial?.paymentType ?? "percentage",
  );
  const [fixedAmount, setFixedAmount] = useState(
    initial?.fixedAmount != null ? String(initial.fixedAmount) : "",
  );
  const [percentage, setPercentage] = useState(
    initial?.percentage != null ? String(initial.percentage) : "",
  );
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({
        crewMemberId,
        paymentType,
        fixedAmount: fixedAmount ? Number(fixedAmount) : null,
        percentage: percentage ? Number(percentage) : null,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Select
        label={t("trips.crewMember")}
        value={crewMemberId}
        onChange={(e) => setCrewMemberId(e.target.value)}
        options={crewMembers.map((c) => ({ value: c.id, label: c.name }))}
        required
      />
      <Select
        label={t("trips.paymentType")}
        value={paymentType}
        onChange={(e) => setPaymentType(e.target.value as TripCrewPaymentType)}
        options={[
          { value: "percentage", label: t("trips.paymentTypePercentage") },
          { value: "fixed", label: t("trips.paymentTypeFixed") },
        ]}
      />
      {paymentType === "fixed" ? (
        <Input
          label={t("trips.fixedAmount")}
          type="number"
          min="0"
          step="0.01"
          value={fixedAmount}
          onChange={(e) => setFixedAmount(e.target.value)}
          required
          dir="ltr"
        />
      ) : (
        <Input
          label={t("trips.percentage")}
          type="number"
          min="0"
          max="100"
          step="0.01"
          value={percentage}
          onChange={(e) => setPercentage(e.target.value)}
          required
          dir="ltr"
        />
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" disabled={submitting || !crewMemberId}>
          {t("common.save")}
        </Button>
      </div>
    </form>
  );
}
