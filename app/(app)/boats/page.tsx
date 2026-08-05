"use client";

import { useState } from "react";
import Link from "next/link";
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
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{t("boats.title")}</h1>
        <Button onClick={() => setFormOpen(true)}>{t("common.add")}</Button>
      </div>

      <Input
        placeholder={t("filters.search")}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {(!filteredRows || filteredRows.length === 0) && (
        <p className="text-sm text-slate-500">{t("common.noResults")}</p>
      )}

      <div className="flex flex-col gap-2">
        {filteredRows?.map((row) => {
          const profit = row.revenue - row.expenses_total - row.crew_payment_total;
          return (
            <Card key={row.id} className="flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div>
                  <Link href={`/boats/${row.id}`} className="font-medium underline">
                    {row.name}
                  </Link>
                  {row.captain_name && (
                    <p className="text-xs text-slate-500">{row.captain_name}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs dark:bg-slate-800">
                    {t(`boats.${STATUS_LABEL_KEY[row.status]}`)}
                  </span>
                  <Button variant="danger" onClick={() => setPendingDeleteId(row.id)}>
                    {t("common.delete")}
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-400 sm:grid-cols-4">
                <div>
                  <p className="text-slate-400">{t("boats.tripsCount")}</p>
                  <p className="font-medium">{row.trips_count}</p>
                </div>
                <div>
                  <p className="text-slate-400">{t("boats.revenue")}</p>
                  <p className="font-medium">{formatCurrency(row.revenue)}</p>
                </div>
                <div>
                  <p className="text-slate-400">{t("boats.expensesTotal")}</p>
                  <p className="font-medium">{formatCurrency(row.expenses_total)}</p>
                </div>
                <div>
                  <p className="text-slate-400">{t("boats.profit")}</p>
                  <p className="font-medium">{formatCurrency(profit)}</p>
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
