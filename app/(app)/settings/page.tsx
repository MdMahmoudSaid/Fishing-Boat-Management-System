"use client";

import Link from "next/link";
import { useState, FormEvent } from "react";
import { usePowerSync, useQuery } from "@powersync/react";
import type { AbstractPowerSyncDatabase } from "@powersync/web";
import { t } from "@/lib/i18n";
import { useCompanyId } from "@/lib/auth/useCompanyId";
import { updateCompanyName } from "@/lib/db/companies";
import {
  updateDefaultCrewPaymentMethod,
  type CrewPaymentMethod,
} from "@/lib/db/settings";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

interface CompanyRow {
  name: string;
}

interface SettingsRow {
  default_crew_payment_method: CrewPaymentMethod;
}

// Isolé dans son propre composant, monté avec `key={company.name}` : évite
// de synchroniser une requête locale vers un state éditable via useEffect
// (anti-pattern react-hooks/set-state-in-effect) — le state part directement
// de la valeur chargée, et se réinitialise si celle-ci change ailleurs.
function CompanyNameField({
  powersync,
  companyId,
  initialName,
}: {
  powersync: AbstractPowerSyncDatabase;
  companyId: string;
  initialName: string;
}) {
  const [companyName, setCompanyName] = useState(initialName);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await updateCompanyName(powersync, companyId, companyName);
  }

  return (
    <form onSubmit={handleSubmit} className="contents">
      <Input
        label={t("settings.companyName")}
        value={companyName}
        onChange={(e) => setCompanyName(e.target.value)}
      />
      <div className="flex justify-end">
        <Button type="submit">{t("common.save")}</Button>
      </div>
    </form>
  );
}

export default function SettingsPage() {
  const powersync = usePowerSync();
  const { companyId } = useCompanyId();

  const { data: companyRows } = useQuery<CompanyRow>(
    "SELECT name FROM companies WHERE id = ?",
    [companyId ?? ""],
  );
  const { data: settingsRows } = useQuery<SettingsRow>(
    "SELECT default_crew_payment_method FROM settings WHERE company_id = ?",
    [companyId ?? ""],
  );

  const company = companyRows?.[0];
  const settings = settingsRows?.[0];

  async function handleCrewPaymentMethodChange(method: CrewPaymentMethod) {
    if (!companyId) return;
    await updateDefaultCrewPaymentMethod(powersync, companyId, method);
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <h1 className="text-xl font-bold">{t("settings.title")}</h1>

      <Card>
        <h2 className="mb-4 font-semibold">{t("settings.company")}</h2>
        <div className="flex flex-col gap-4">
          {company && companyId && (
            <CompanyNameField
              key={company.name}
              powersync={powersync}
              companyId={companyId}
              initialName={company.name}
            />
          )}
          <Select
            label={t("settings.crewPaymentMethod")}
            value={settings?.default_crew_payment_method ?? "percentage_after_expenses"}
            onChange={(e) =>
              handleCrewPaymentMethodChange(e.target.value as CrewPaymentMethod)
            }
            options={[
              {
                value: "percentage_gross",
                label: t("settings.crewPaymentMethodGross"),
              },
              {
                value: "percentage_after_expenses",
                label: t("settings.crewPaymentMethodAfterExpenses"),
              },
            ]}
          />
        </div>
      </Card>

      <Card className="flex flex-col gap-3">
        <Link href="/settings/fish-categories" className="underline">
          {t("settings.fishCategories")}
        </Link>
        <Link href="/settings/fish-quality-levels" className="underline">
          {t("settings.fishQualityLevels")}
        </Link>
        <Link href="/settings/expense-categories" className="underline">
          {t("settings.expenseCategories")}
        </Link>
      </Card>
    </main>
  );
}
