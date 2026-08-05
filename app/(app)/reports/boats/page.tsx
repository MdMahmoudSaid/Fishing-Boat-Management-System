"use client";

import Link from "next/link";
import { useQuery } from "@powersync/react";
import { t } from "@/lib/i18n";
import { formatCurrency } from "@/lib/format";
import { useCompanyId } from "@/lib/auth/useCompanyId";
import { Card } from "@/components/ui/Card";

interface BoatReportRow {
  id: string;
  name: string;
  trips_count: number;
  revenue: number;
  expenses_total: number;
  crew_payment_total: number;
}

const QUERY = `
  SELECT
    b.id,
    b.name,
    (SELECT COUNT(*) FROM trips t WHERE t.boat_id = b.id AND t.deleted_at IS NULL) AS trips_count,
    (SELECT COALESCE(SUM(s.total_amount), 0) FROM sales s JOIN trips t ON t.id = s.trip_id WHERE t.boat_id = b.id) AS revenue,
    (SELECT COALESCE(SUM(e.amount), 0) FROM expenses e JOIN trips t ON t.id = e.trip_id WHERE t.boat_id = b.id) AS expenses_total,
    (SELECT COALESCE(SUM(tc.computed_amount), 0) FROM trip_crew tc JOIN trips t ON t.id = tc.trip_id WHERE t.boat_id = b.id) AS crew_payment_total
  FROM boats b
  WHERE b.company_id = ? AND b.deleted_at IS NULL
  ORDER BY b.name
`;

export default function BoatReportPage() {
  const { companyId } = useCompanyId();
  const { data: rows } = useQuery<BoatReportRow>(QUERY, [companyId ?? ""]);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
      <Link href="/reports" className="text-sm underline">
        {t("reports.title")}
      </Link>
      <h1 className="text-xl font-bold">{t("reports.boatReport")}</h1>

      {(!rows || rows.length === 0) && (
        <p className="text-sm text-slate-500">{t("common.noResults")}</p>
      )}

      <div className="flex flex-col gap-2">
        {rows?.map((row) => {
          const profit = row.revenue - row.expenses_total - row.crew_payment_total;
          return (
            <Card key={row.id} className="flex flex-col gap-2">
              <p className="font-medium">{row.name}</p>
              <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                <div>
                  <p className="text-xs text-slate-400">{t("boats.tripsCount")}</p>
                  <p>{row.trips_count}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">{t("boats.revenue")}</p>
                  <p>{formatCurrency(row.revenue)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">{t("boats.expensesTotal")}</p>
                  <p>{formatCurrency(row.expenses_total)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">{t("boats.profit")}</p>
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
