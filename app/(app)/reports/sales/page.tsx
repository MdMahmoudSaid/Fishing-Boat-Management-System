"use client";

import Link from "next/link";
import { useQuery } from "@powersync/react";
import { t } from "@/lib/i18n";
import { formatCurrency } from "@/lib/format";
import { useCompanyId } from "@/lib/auth/useCompanyId";
import { Card } from "@/components/ui/Card";

interface SaleRow {
  id: string;
  date: string;
  buyer_name: string;
  fish_category_name: string;
  fish_quality_level_name: string;
  quantity: number;
  total_amount: number;
}

interface ByBuyerRow {
  buyer_name: string;
  total: number;
}

interface ByFishRow {
  fish_category_name: string;
  total: number;
}

export default function SalesReportPage() {
  const { companyId } = useCompanyId();
  const cid = companyId ?? "";

  const { data: sales } = useQuery<SaleRow>(
    `SELECT s.id, s.date, s.quantity, s.total_amount,
            b.name AS buyer_name, fc.name AS fish_category_name, fq.name AS fish_quality_level_name
     FROM sales s
     JOIN buyers b ON b.id = s.buyer_id
     JOIN fish_categories fc ON fc.id = s.fish_category_id
     JOIN fish_quality_levels fq ON fq.id = s.fish_quality_level_id
     WHERE s.company_id = ?
     ORDER BY s.date DESC`,
    [cid],
  );

  const { data: byBuyer } = useQuery<ByBuyerRow>(
    `SELECT b.name AS buyer_name, SUM(s.total_amount) AS total
     FROM sales s JOIN buyers b ON b.id = s.buyer_id
     WHERE s.company_id = ?
     GROUP BY s.buyer_id ORDER BY total DESC`,
    [cid],
  );

  const { data: byFish } = useQuery<ByFishRow>(
    `SELECT fc.name AS fish_category_name, SUM(s.total_amount) AS total
     FROM sales s JOIN fish_categories fc ON fc.id = s.fish_category_id
     WHERE s.company_id = ?
     GROUP BY s.fish_category_id ORDER BY total DESC`,
    [cid],
  );

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <Link href="/reports" className="text-sm underline">
        {t("reports.title")}
      </Link>
      <h1 className="text-xl font-bold">{t("reports.salesReport")}</h1>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-500">
          {t("reports.buyer")}
        </h2>
        <div className="flex flex-col gap-1">
          {byBuyer?.map((row) => (
            <Card key={row.buyer_name} className="flex items-center justify-between">
              <span>{row.buyer_name}</span>
              <span className="font-semibold">{formatCurrency(row.total)}</span>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-500">
          {t("catches.fishCategory")}
        </h2>
        <div className="flex flex-col gap-1">
          {byFish?.map((row) => (
            <Card
              key={row.fish_category_name}
              className="flex items-center justify-between"
            >
              <span>{row.fish_category_name}</span>
              <span className="font-semibold">{formatCurrency(row.total)}</span>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-500">
          {t("sales.title")}
        </h2>
        {(!sales || sales.length === 0) && (
          <p className="text-sm text-slate-500">{t("common.noResults")}</p>
        )}
        <div className="flex flex-col gap-1">
          {sales?.map((sale) => (
            <Card key={sale.id} className="flex items-center justify-between">
              <div>
                <p className="text-sm">{sale.buyer_name}</p>
                <p className="text-xs text-slate-500">
                  {sale.fish_category_name} — {sale.fish_quality_level_name}
                </p>
                <p className="text-xs text-slate-500" dir="ltr">
                  {sale.date}
                </p>
              </div>
              <span className="font-semibold">{formatCurrency(sale.total_amount)}</span>
            </Card>
          ))}
        </div>
      </div>
    </main>
  );
}
