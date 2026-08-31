"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { t } from "@/lib/i18n";
import { adminFetch, AdminFetchError } from "@/lib/admin/adminFetch";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { CompanyForm, type CompanyFormInput } from "@/components/forms/CompanyForm";

export default function NewCompanyPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(input: CompanyFormInput) {
    setError(null);
    try {
      const result = await adminFetch<{ companyId: string }>("/api/admin/companies", {
        method: "POST",
        body: JSON.stringify(input),
      });
      router.replace(`/admin/companies/${result.companyId}`);
    } catch (err) {
      if (err instanceof AdminFetchError && err.status === 409) {
        setError(t("admin.duplicatePhoneError"));
      } else {
        setError(t("admin.createError"));
      }
    }
  }

  return (
    <>
      <PageHeader title={t("admin.addCompany")} backHref="/admin/companies" />
      <Card>
        <CompanyForm
          onSubmit={handleSubmit}
          submitLabel={t("admin.createButton")}
          submittingLabel={t("admin.creating")}
          error={error}
        />
      </Card>
    </>
  );
}
