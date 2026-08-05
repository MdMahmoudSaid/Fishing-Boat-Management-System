"use client";

import { useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { usePowerSync, useQuery } from "@powersync/react";
import { t } from "@/lib/i18n";
import { formatCurrency } from "@/lib/format";
import { useCompanyId } from "@/lib/auth/useCompanyId";
import {
  createBoat,
  softDeleteBoat,
  type BoatInput,
  type BoatStatus,
} from "@/lib/db/boats";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { PageHeader } from "@/components/ui/PageHeader";
import { BoatForm } from "@/components/forms/BoatForm";

interface BoatRow {
  id: string;
  name: string;
  registration_number: string | null;
  captain_name: string | null;
  status: BoatStatus;
  trips_count: number;
  revenue: number;
  expenses_total: number;
  crew_payment_total: number;
}

const STATUS_LABEL_KEY: Record<BoatStatus, "statusActive" | "statusMaintenance" | "statusInTrip"> = {
  active: "statusActive",
  maintenance: "statusMaintenance",
  in_trip: "statusInTrip",
};

const STATUS_BADGE_CLASS: Record<BoatStatus, string> = {
  active: "bg-success-soft text-success",
  maintenance: "bg-rope-soft text-rope-dark",
  in_trip: "bg-sea-soft text-sea",
};

// Agrégats calculés par sous-requêtes corrélées (pas de JOIN direct entre
// sales/expenses/trip_crew, qui produirait un produit cartésien et fausserait
// les sommes). Revenue/crew_payment_total resteront à 0 tant que les Phases
// 5/6 (sales, computed_amount) n'existent pas — c'est attendu.
const BOATS_QUERY = `
  SELECT
    b.id,
    b.name,
    b.registration_number,
    b.captain_name,
    b.status,
    (SELECT COUNT(*) FROM trips t WHERE t.boat_id = b.id AND t.deleted_at IS NULL) AS trips_count,
    (SELECT COALESCE(SUM(s.total_amount), 0) FROM sales s JOIN trips t ON t.id = s.trip_id WHERE t.boat_id = b.id) AS revenue,
    (SELECT COALESCE(SUM(e.amount), 0) FROM expenses e JOIN trips t ON t.id = e.trip_id WHERE t.boat_id = b.id) AS expenses_total,
    (SELECT COALESCE(SUM(tc.computed_amount), 0) FROM trip_crew tc JOIN trips t ON t.id = tc.trip_id WHERE t.boat_id = b.id) AS crew_payment_total
  FROM boats b
  WHERE b.company_id = ? AND b.deleted_at IS NULL
  ORDER BY b.name
`;

export default function BoatsPage() {
  const powersync = usePowerSync();
  const { companyId } = useCompanyId();

  const { data: rows } = useQuery<BoatRow>(BOATS_QUERY, [companyId ?? ""]);

  const [formOpen, setFormOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const filteredRows = rows?.filter((row) =>
    row.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  async function handleSubmit(input: BoatInput) {
    if (!companyId) return;
    await createBoat(powersync, companyId, input);
    setFormOpen(false);
  }

  async function handleConfirmDelete() {
    if (pendingDeleteId) {
      await softDeleteBoat(powersync, pendingDeleteId);
    }
    setPendingDeleteId(null);
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
      <PageHeader
        title={t("boats.title")}
        backHref="/"
        action={
          <Button onClick={() => setFormOpen(true)} className="px-3">
            {t("common.add")}
          </Button>
        }
      />

      <div className="relative">
        <Search size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-faint" />
        <Input
          placeholder={t("filters.search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ps-9"
        />
      </div>

      {(!filteredRows || filteredRows.length === 0) && (
        <p className="py-6 text-center text-sm text-ink-faint">{t("common.noResults")}</p>
      )}

      <div className="flex flex-col gap-2">
        {filteredRows?.map((row) => {
          const profit = row.revenue - row.expenses_total - row.crew_payment_total;
          return (
            <Card key={row.id} className="flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div>
                  <Link
                    href={`/boats/${row.id}`}
                    className="font-display text-base font-semibold text-ink hover:text-rope dark:text-sand"
                  >
                    {row.name}
                  </Link>
                  {row.captain_name && (
                    <p className="text-xs text-ink-faint">{row.captain_name}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_BADGE_CLASS[row.status]}`}
                  >
                    {t(`boats.${STATUS_LABEL_KEY[row.status]}`)}
                  </span>
                  <Button
                    variant="danger"
                    onClick={() => setPendingDeleteId(row.id)}
                    className="px-3 py-1.5 text-xs"
                  >
                    {t("common.delete")}
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 border-t border-sand-dim pt-3 text-xs text-ink-soft dark:border-white/10 sm:grid-cols-4">
                <div>
                  <p className="text-ink-faint">{t("boats.tripsCount")}</p>
                  <p className="font-medium text-ink dark:text-sand">{row.trips_count}</p>
                </div>
                <div>
                  <p className="text-ink-faint">{t("boats.revenue")}</p>
                  <p className="font-medium text-ink dark:text-sand">{formatCurrency(row.revenue)}</p>
                </div>
                <div>
                  <p className="text-ink-faint">{t("boats.expensesTotal")}</p>
                  <p className="font-medium text-ink dark:text-sand">{formatCurrency(row.expenses_total)}</p>
                </div>
                <div>
                  <p className="text-ink-faint">{t("boats.profit")}</p>
                  <p className="font-medium text-ink dark:text-sand">{formatCurrency(profit)}</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={t("common.add")}>
        <BoatForm onSubmit={handleSubmit} onCancel={() => setFormOpen(false)} />
      </Modal>

      <ConfirmDialog
        open={pendingDeleteId !== null}
        title={t("settings.confirmDeleteTitle")}
        message={t("boats.confirmDeleteMessage")}
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDeleteId(null)}
      />
    </main>
  );
}
