"use client";

import Link from "next/link";
import { useState, FormEvent } from "react";
import { usePowerSync, useQuery } from "@powersync/react";
import type { AbstractPowerSyncDatabase } from "@powersync/web";
import { Fish, Award, Wallet, ChevronLeft, Building2 } from "lucide-react";
import { t, setLocale, type Locale } from "@/lib/i18n";
import { useCompanyId } from "@/lib/auth/useCompanyId";
import { updateCompanyName } from "@/lib/db/companies";
import {
  updateDefaultCrewPaymentMethod,
  updateLanguage,
  type CrewPaymentMethod,
} from "@/lib/db/settings";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";

const SETTINGS_LINKS = [
  { href: "/settings/fish-categories", labelKey: "settings.fishCategories", icon: Fish },
  { href: "/settings/fish-quality-levels", labelKey: "settings.fishQualityLevels", icon: Award },
  { href: "/settings/expense-categories", labelKey: "settings.expenseCategories", icon: Wallet },
] as const;

interface CompanyRow {
  name: string;
}

interface SettingsRow {
  default_crew_payment_method: CrewPaymentMethod;
  language: Locale;
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
    "SELECT default_crew_payment_method, language FROM settings WHERE company_id = ?",
    [companyId ?? ""],
  );

  const company = companyRows?.[0];
  const settings = settingsRows?.[0];

  async function handleCrewPaymentMethodChange(method: CrewPaymentMethod) {
    if (!companyId) return;
    await updateDefaultCrewPaymentMethod(powersync, companyId, method);
  }

  // Mise à jour optimiste (setLocale) en plus de la persistance PowerSync :
  // applique immédiatement la langue/direction sans attendre le round-trip
  // de la requête réactive (voir lib/i18n/LocaleProvider.tsx pour la
  // réconciliation avec settings.language).
  async function handleLanguageChange(locale: Locale) {
    if (!companyId) return;
    await updateLanguage(powersync, companyId, locale);
    setLocale(locale);
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <PageHeader title={t("settings.title")} backHref="/" />

      <Card>
        <h2 className="mb-4 flex items-center gap-2 font-semibold text-ink dark:text-sand">
          <Building2 size={16} className="text-rope" />
          {t("settings.company")}
        </h2>
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
          <Select
            label={t("settings.language")}
            value={settings?.language ?? "ar"}
            onChange={(e) => handleLanguageChange(e.target.value as Locale)}
            options={[
              // Le nom d'une langue s'affiche dans sa propre graphie, pas
              // traduit via t() — convention universelle des sélecteurs de
              // langue.
              { value: "ar", label: "العربية" },
              { value: "fr", label: "Français" },
            ]}
          />
        </div>
      </Card>

      <div className="flex flex-col divide-y divide-sand-dim overflow-hidden rounded-2xl border border-sand-dim bg-foam shadow-[0_1px_2px_rgba(11,18,32,0.04)] dark:divide-white/10 dark:border-white/10 dark:bg-white/5">
        {SETTINGS_LINKS.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-3 px-4 py-3.5 text-sm text-ink transition-colors hover:bg-sand dark:text-sand dark:hover:bg-white/5"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rope-soft text-rope dark:bg-white/10">
                <Icon size={16} />
              </span>
              <span className="flex-1 font-medium">{t(link.labelKey)}</span>
              <ChevronLeft size={16} className="text-ink-faint ltr:rotate-180" />
            </Link>
          );
        })}
      </div>
    </main>
  );
}
