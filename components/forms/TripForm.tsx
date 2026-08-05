"use client";

import { FormEvent, useState } from "react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { t } from "@/lib/i18n";
import type { TripCrewPaymentMethod, TripInput } from "@/lib/db/trips";

interface TripFormProps {
  boats: { id: string; name: string }[];
  // Verrouille le sélecteur de bateau (mode édition : on ne réassigne pas un
  // trip existant à un autre bateau).
  boatLocked?: boolean;
  initial?: TripInput;
  defaultCrewPaymentMethod: TripCrewPaymentMethod;
  onSubmit: (input: TripInput) => Promise<void>;
  onCancel: () => void;
}

export function TripForm({
  boats,
  boatLocked = false,
  initial,
  defaultCrewPaymentMethod,
  onSubmit,
  onCancel,
}: TripFormProps) {
  const [boatId, setBoatId] = useState(initial?.boatId ?? boats[0]?.id ?? "");
  const [captainName, setCaptainName] = useState(initial?.captainName ?? "");
  const [departureDate, setDepartureDate] = useState(initial?.departureDate ?? "");
  const [expectedReturnDate, setExpectedReturnDate] = useState(
    initial?.expectedReturnDate ?? "",
  );
  const [crewPaymentMethod, setCrewPaymentMethod] = useState<TripCrewPaymentMethod>(
    initial?.crewPaymentMethod ?? defaultCrewPaymentMethod,
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({
        boatId,
        captainName: captainName || null,
        departureDate,
        expectedReturnDate: expectedReturnDate || null,
        crewPaymentMethod,
        notes: notes || null,
      });
    } finally {
      setSubmitting(false);
    }
  }

  const boatName = boats.find((b) => b.id === boatId)?.name ?? "";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {boatLocked ? (
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {t("trips.boat")}
          </span>
          <span className="text-sm">{boatName}</span>
        </div>
      ) : (
        <Select
          label={t("trips.boat")}
          value={boatId}
          onChange={(e) => setBoatId(e.target.value)}
          options={boats.map((b) => ({ value: b.id, label: b.name }))}
          required
        />
      )}
      <Input
        label={t("trips.captainName")}
        value={captainName}
        onChange={(e) => setCaptainName(e.target.value)}
      />
      <Input
        label={t("trips.departureDate")}
        type="date"
        value={departureDate}
        onChange={(e) => setDepartureDate(e.target.value)}
        required
        dir="ltr"
      />
      <Input
        label={t("trips.expectedReturnDate")}
        type="date"
        value={expectedReturnDate}
        onChange={(e) => setExpectedReturnDate(e.target.value)}
        dir="ltr"
      />
      <Select
        label={t("trips.crewPaymentMethod")}
        value={crewPaymentMethod}
        onChange={(e) => setCrewPaymentMethod(e.target.value as TripCrewPaymentMethod)}
        options={[
          { value: "fixed", label: t("trips.crewPaymentMethodFixed") },
          { value: "percentage_gross", label: t("trips.crewPaymentMethodGross") },
          {
            value: "percentage_after_expenses",
            label: t("trips.crewPaymentMethodAfterExpenses"),
          },
        ]}
      />
      <Input
        label={t("trips.notes")}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" disabled={submitting || !boatId}>
          {t("common.save")}
        </Button>
      </div>
    </form>
  );
}
