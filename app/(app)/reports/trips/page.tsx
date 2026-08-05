"use client";

import { useQuery } from "@powersync/react";
import { t } from "@/lib/i18n";
import { formatCurrency } from "@/lib/format";
import { useCompanyId } from "@/lib/auth/useCompanyId";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

interface TripReportRow {
  id: string;
  boat_name: string;
  status: "preparing" | "at_sea" | "returned" | "closed";
  departure_date: string;
  revenue: number;
  expenses_total: number;
  crew_payment_total: number;
}

const STATUS_LABEL_KEY = {
  preparing: "statusPreparing",
  at_sea: "statusAtSea",
  returned: "statusReturned",
  closed: "statusClosed",
} as const;

const QUERY = `
  SELECT
    t.id,
    b.name AS boat_name,
    t.status,
    t.departure_date,
    COALESCE((SELECT SUM(s.total_amount) FROM sales s WHERE s.trip_id = t.id), 0) AS revenue,
    COALESCE((SELECT SUM(e.amount) FROM expenses e WHERE e.trip_id = t.id), 0) AS expenses_total,
    COALESCE((SELECT SUM(tc.computed_amount) FROM trip_crew tc WHERE tc.trip_id = t.id), 0) AS crew_payment_total
  FROM trips t
  JOIN boats b ON b.id = t.boat_id
  WHERE t.company_id = ? AND t.deleted_at IS NULL
  ORDER BY t.departure_date DESC
`;

export default function TripReportPage() {
  const { companyId } = useCompanyId();
  const { data: rows } = useQuery<TripReportRow>(QUERY, [companyId ?? ""]);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
      <PageHeader title={t("reports.tripReport")} backHref="/reports" />

      {(!rows || rows.length === 0) && (
        <p className="text-sm text-ink-faint">{t("common.noResults")}</p>
      )}

      <div className="flex flex-col gap-2">
        {rows?.map((row) => {
          const profit = row.revenue - row.expenses_total - row.crew_payment_total;
          return (
            <Card key={row.id} className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{row.boat_name}</p>
                  <p className="text-xs text-ink-faint" dir="ltr">
                    {row.departure_date}
                  </p>
                </div>
                <span className="rounded-full bg-sand-dim px-3 py-1 text-xs dark:bg-white/10">
                  {t(`trips.${STATUS_LABEL_KEY[row.status]}`)}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <p className="text-xs text-ink-faint">{t("boats.revenue")}</p>
                  <p>{formatCurrency(row.revenue)}</p>
                </div>
                <div>
                  <p className="text-xs text-ink-faint">{t("boats.expensesTotal")}</p>
                  <p>{formatCurrency(row.expenses_total)}</p>
                </div>
                <div>
                  <p className="text-xs text-ink-faint">{t("boats.profit")}</p>
                  <p className="font-semibold">{formatCurrency(profit)}</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </main>
  );
}
