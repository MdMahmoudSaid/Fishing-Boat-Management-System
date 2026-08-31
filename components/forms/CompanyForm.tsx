"use client";

import { FormEvent, useState } from "react";
import { Input } from "@/components/ui/Input";
import { PhoneInput } from "@/components/ui/PhoneInput";
import { CodeInput } from "@/components/ui/CodeInput";
import { Button } from "@/components/ui/Button";
import { isValidLoginCode, isValidMauritanianPhone } from "@/lib/auth/phoneAuth";
import { t } from "@/lib/i18n";

export interface CompanyFormInput {
  companyName: string;
  ownerName: string;
  phone: string;
  code: string;
}

interface CompanyFormProps {
  onSubmit: (input: CompanyFormInput) => Promise<void>;
  submitLabel: string;
  submittingLabel: string;
  error?: string | null;
}

export function CompanyForm({ onSubmit, submitLabel, submittingLabel, error }: CompanyFormProps) {
  const [companyName, setCompanyName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit =
    companyName.trim() !== "" &&
    ownerName.trim() !== "" &&
    isValidMauritanianPhone(phone) &&
    isValidLoginCode(code);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onSubmit({ companyName, ownerName, phone, code });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        label={t("admin.companyName")}
        value={companyName}
        onChange={(e) => setCompanyName(e.target.value)}
        required
      />
      <Input
        label={t("admin.ownerName")}
        value={ownerName}
        onChange={(e) => setOwnerName(e.target.value)}
        required
      />
      <PhoneInput
        id="owner-phone"
        label={t("admin.ownerPhone")}
        value={phone}
        onChange={setPhone}
        required
        placeholder="XXXXXXXX"
      />
      <CodeInput id="owner-code" label={t("auth.code")} value={code} onChange={setCode} required />
      {error && (
        <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>
      )}
      <Button type="submit" disabled={submitting || !canSubmit}>
        {submitting ? submittingLabel : submitLabel}
      </Button>
    </form>
  );
}
