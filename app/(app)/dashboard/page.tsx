"use client";

import Link from "next/link";
import { useQuery } from "@powersync/react";
import { t } from "@/lib/i18n";
import { formatCurrency } from "@/lib/format";
import { useCompanyId } from "@/lib/auth/useCompanyId";
import { computeRemainingStock } from "@/lib/calculations/inventory";
import { Card } from "@/components/ui/Card";

interface CountRow {
  count: number;
}
interface SumRow {
  total: number;
}
interface CatchRow {
  fish_category_id: string;
  fish_quality_level_id: string;
  quantity: number;
}
interface SaleQuantityRow {
  fish_category_id: string;
  fish_quality_level_id: string;
  quantity: number;
}
interface QualityPriceRow {
  id: string;
  default_price: number | null;
}
interface RecentTripRow {
  id: string;
  status: "preparing" | "at_sea" | "returned" | "closed";
  departure_date: string;
  boat_name: string;
}

const STATUS_LABEL_KEY = {
  preparing: "statusPreparing",
  at_sea: "statusAtSea",
  returned: "statusReturned",
  closed: "statusClosed",
} as const;

export default function DashboardPage() {
  const { companyId } = useCompanyId();
  const cid = companyId ?? "";

  const { data: boatsCount } = useQuery<CountRow>(
    "SELECT COUNT(*) AS count FROM boats WHERE company_id = ? AND deleted_at IS NULL",
    [cid],
  );
  const { data: activeTripsCount } = useQuery<CountRow>(
    "SELECT COUNT(*) AS count FROM trips WHERE company_id = ? AND deleted_at IS NULL AND status != 'closed'",
    [cid],
  );
  const { data: completedTripsCount } = useQuery<CountRow>(
    "SELECT COUNT(*) AS count FROM trips WHERE company_id = ? AND deleted_at IS NULL AND status = 'closed'",
    [cid],
  );
  const { data: revenueRow } = useQuery<SumRow>(
    "SELECT COALESCE(SUM(total_amount), 0) AS total FROM sales WHERE company_id = ?",
    [cid],
  );
  const { data: expensesRow } = useQuery<SumRow>(
    "SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE company_id = ?",
    [cid],
  );
  const { data: crewPaymentsRow } = useQuery<SumRow>(
    "SELECT COALESCE(SUM(computed_amount), 0) AS total FROM trip_crew WHERE company_id = ?",
    [cid],
  );
  const { data: paymentsRow } = useQuery<SumRow>(
    "SELECT COALESCE(SUM(sp.amount), 0) AS total FROM sale_payments sp JOIN sales s ON s.id = sp.sale_id WHERE s.company_id = ?",
    [cid],
  );
  const { data: catches } = useQuery<CatchRow>(
    "SELECT fish_category_id, fish_quality_level_id, quantity FROM catches WHERE company_id = ?",
    [cid],
  );
  const { data: saleQuantities } = useQuery<SaleQuantityRow>(
    "SELECT fish_category_id, fish_quality_level_id, quantity FROM sales WHERE company_id = ?",
    [cid],
  );
  const { data: qualityPrices } = useQuery<QualityPriceRow>(
    "SELECT id, default_price FROM fish_quality_levels WHERE company_id = ?",
    [cid],
  );
  const { data: recentTrips } = useQuery<RecentTripRow>(
    `SELECT t.id, t.status, t.departure_date, b.name AS boat_name
     FROM trips t JOIN boats b ON b.id = t.boat_id
     WHERE t.company_id = ? AND t.deleted_at IS NULL
     ORDER BY t.departure_date DESC, t.created_at DESC
     LIMIT 5`,
    [cid],
  );

  const totalRevenue = revenueRow?.[0]?.total ?? 0;
  const totalExpenses = expensesRow?.[0]?.total ?? 0;
  const totalCrewPayments = crewPaymentsRow?.[0]?.total ?? 0;
  const netProfit = totalRevenue - totalExpenses - totalCrewPayments;
  const totalPaid = paymentsRow?.[0]?.total ?? 0;
  const outstandingDebt = totalRevenue - totalPaid;

  const stock = computeRemainingStock(
    (catches ?? []).map((c) => ({
      fishCategoryId: c.fish_category_id,
      fishQualityLevelId: c.fish_quality_level_id,
      quantity: c.quantity,
    })),
    (saleQuantities ?? []).map((s) => ({
      fishCategoryId: s.fish_category_id,
      fishQualityLevelId: s.fish_quality_level_id,
      quantity: s.quantity,
    })),
  );
  const unsoldStockValue = stock.reduce((sum, group) => {
    const price = qualityPrices?.find((q) => q.id === group.fishQualityLevelId)
      ?.default_price;
    return sum + group.remainingQuantity * (price ?? 0);
  }, 0);

  const cards: { labelKey: Parameters<typeof t>[0]; value: string }[] = [
    { labelKey: "dashboard.totalBoats", value: String(boatsCount?.[0]?.count ?? 0) },
    {
      labelKey: "dashboard.activeTrips",
      value: String(activeTripsCount?.[0]?.count ?? 0),
    },
    {
      labelKey: "dashboard.completedTrips",
      value: String(completedTripsCount?.[0]?.count ?? 0),
    },
    { labelKey: "dashboard.totalRevenue", value: formatCurrency(totalRevenue) },
    { labelKey: "dashboard.totalExpenses", value: formatCurrency(totalExpenses) },
    {
      labelKey: "dashboard.totalCrewPayments",
      value: formatCurrency(totalCrewPayments),
    },
    { labelKey: "dashboard.netProfit", value: formatCurrency(netProfit) },
    {
      labelKey: "dashboard.unsoldStockValue",
      value: formatCurrency(unsoldStockValue),
    },
    { labelKey: "dashboard.outstandingDebt", value: formatCurrency(outstandingDebt) },
  ];

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <h1 className="text-xl font-bold">{t("dashboard.title")}</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {cards.map((card) => (
          <Card key={card.labelKey}>
            <p className="text-xs text-slate-400">{t(card.labelKey)}</p>
            <p className="mt-1 text-lg font-semibold">{card.value}</p>
          </Card>
        ))}
      </div>

      <div>
        <h2 className="mb-3 font-semibold">{t("dashboard.recentTrips")}</h2>
        <div className="flex flex-col gap-2">
          {recentTrips?.map((trip) => (
            <Link key={trip.id} href={`/trips/${trip.id}`}>
              <Card className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{trip.boat_name}</p>
                  <p className="text-xs text-slate-500" dir="ltr">
                    {trip.departure_date}
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs dark:bg-slate-800">
                  {t(`trips.${STATUS_LABEL_KEY[trip.status]}`)}
                </span>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
