"use client";

import { useState } from "react";
import Link from "next/link";
import { usePowerSync, useQuery } from "@powersync/react";
import { t } from "@/lib/i18n";
import { useCompanyId } from "@/lib/auth/useCompanyId";
import { createTrip, type TripInput, type TripCrewPaymentMethod } from "@/lib/db/trips";
import { TripValidationError } from "@/lib/calculations/tripValidation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { TripForm } from "@/components/forms/TripForm";

type TripStatus = "preparing" | "at_sea" | "returned" | "closed";

interface TripRow {
  id: string;
  boat_id: string;
  status: TripStatus;
  departure_date: string;
  boat_name: string;
}

interface BoatOption {
  id: string;
  name: string;
}

interface SettingsRow {
  default_crew_payment_method: TripCrewPaymentMethod;
}

const STATUS_LABEL_KEY = {
  preparing: "statusPreparing",
  at_sea: "statusAtSea",
  returned: "statusReturned",
  closed: "statusClosed",
} as const;

const STATUS_BADGE_CLASS: Record<TripStatus, string> = {
  preparing: "bg-sand-dim text-ink-soft dark:bg-white/10 dark:text-sand/70",
  at_sea: "bg-sea-soft text-sea",
  returned: "bg-rope-soft text-rope-dark",
  closed: "bg-success-soft text-success",
};

export default function TripsPage() {
  const powersync = usePowerSync();
  const { companyId } = useCompanyId();

  const { data: rows } = useQuery<TripRow>(
    `SELECT t.id, t.boat_id, t.status, t.departure_date, b.name AS boat_name
     FROM trips t JOIN boats b ON b.id = t.boat_id
     WHERE t.company_id = ? AND t.deleted_at IS NULL
     ORDER BY t.departure_date DESC, t.created_at DESC`,
    [companyId ?? ""],
  );

  const [boatFilter, setBoatFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const filteredRows = rows?.filter(
    (row) =>
      (!boatFilter || row.boat_id === boatFilter) &&
      (!statusFilter || row.status === statusFilter),
  );

  const { data: boats } = useQuery<BoatOption>(
    "SELECT id, name FROM boats WHERE company_id = ? AND deleted_at IS NULL ORDER BY name",
    [companyId ?? ""],
  );

  const { data: settingsRows } = useQuery<SettingsRow>(
    "SELECT default_crew_payment_method FROM settings WHERE company_id = ?",
    [companyId ?? ""],
  );

  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(input: TripInput) {
    if (!companyId) return;
    setError(null);
    try {
      await createTrip(powersync, companyId, input);
      setFormOpen(false);
    } catch (err) {
      setError(
        err instanceof TripValidationError ? err.message : t("trips.activeTripError"),
      );
    }
  }

  const defaultCrewPaymentMethod =
    settingsRows?.[0]?.default_crew_payment_method ?? "percentage_after_expenses";

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
      <PageHeader
        title={t("trips.title")}
        backHref="/"
        action={
          <Button
            onClick={() => {
              setError(null);
              setFormOpen(true);
            }}
            disabled={!boats || boats.length === 0}
            className="px-3"
          >
            {t("common.add")}
          </Button>
        }
      />

      {(!boats || boats.length === 0) && (
        <p className="text-sm text-ink-faint">{t("trips.noBoatsAvailable")}</p>
      )}

      {boats && boats.length > 0 && (
        <div className="flex gap-2">
          <Select
            value={boatFilter}
            onChange={(e) => setBoatFilter(e.target.value)}
            options={[
              { value: "", label: t("filters.all") },
              ...boats.map((b) => ({ value: b.id, label: b.name })),
            ]}
          />
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[
              { value: "", label: t("filters.all") },
              { value: "preparing", label: t("trips.statusPreparing") },
              { value: "at_sea", label: t("trips.statusAtSea") },
              { value: "returned", label: t("trips.statusReturned") },
              { value: "closed", label: t("trips.statusClosed") },
            ]}
          />
        </div>
      )}

      {(!filteredRows || filteredRows.length === 0) && (
        <p className="text-sm text-ink-faint">{t("common.noResults")}</p>
      )}

      <div className="flex flex-col gap-2">
        {filteredRows?.map((row) => (
          <Link key={row.id} href={`/trips/${row.id}`}>
            <Card className="flex items-center justify-between transition-shadow hover:shadow-md">
              <div>
                <p className="font-medium text-ink dark:text-sand">{row.boat_name}</p>
                <p className="text-xs text-ink-faint" dir="ltr">
                  {row.departure_date}
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_BADGE_CLASS[row.status]}`}
              >
                {t(`trips.${STATUS_LABEL_KEY[row.status]}`)}
              </span>
            </Card>
          </Link>
        ))}
      </div>

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={t("common.add")}>
        {error && <p className="mb-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
        <TripForm
          boats={boats ?? []}
          defaultCrewPaymentMethod={defaultCrewPaymentMethod}
          onSubmit={handleSubmit}
          onCancel={() => setFormOpen(false)}
        />
      </Modal>
    </main>
  );
}
