"use client";

import { FormEvent, useState } from "react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { t } from "@/lib/i18n";
import type { BoatInput, BoatStatus } from "@/lib/db/boats";

interface BoatFormProps {
  initial?: BoatInput;
  onSubmit: (input: BoatInput) => Promise<void>;
  onCancel: () => void;
}

export function BoatForm({ initial, onSubmit, onCancel }: BoatFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [registrationNumber, setRegistrationNumber] = useState(
    initial?.registrationNumber ?? "",
  );
  const [captainName, setCaptainName] = useState(initial?.captainName ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [status, setStatus] = useState<BoatStatus>(initial?.status ?? "active");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({
        name,
        registrationNumber: registrationNumber || null,
        captainName: captainName || null,
        notes: notes || null,
        status,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        label={t("boats.name")}
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <Input
        label={t("boats.registrationNumber")}
        value={registrationNumber}
        onChange={(e) => setRegistrationNumber(e.target.value)}
        dir="ltr"
      />
      <Input
        label={t("boats.captainName")}
        value={captainName}
        onChange={(e) => setCaptainName(e.target.value)}
      />
      <Select
        label={t("boats.status")}
        value={status}
        onChange={(e) => setStatus(e.target.value as BoatStatus)}
        options={[
          { value: "active", label: t("boats.statusActive") },
          { value: "maintenance", label: t("boats.statusMaintenance") },
          { value: "in_trip", label: t("boats.statusInTrip") },
        ]}
      />
      <Input
        label={t("boats.notes")}
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
