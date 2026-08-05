"use client";

import Link from "next/link";
import { useQuery } from "@powersync/react";
import { t } from "@/lib/i18n";
import { formatCurrency } from "@/lib/format";
import { useCompanyId } from "@/lib/auth/useCompanyId";
import { Card } from "@/components/ui/Card";

interface DebtRow {
  buyer_id: string;
  buyer_name: string;
  total_sales: number;
  total_paid: number;
}

const QUERY = `
  SELECT
    b.id AS buyer_id,
    b.name AS buyer_name,
    COALESCE((SELECT SUM(s.total_amount) FROM sales s WHERE s.buyer_id = b.id), 0) AS total_sales,
    COALESCE(
      (SELECT SUM(sp.amount) FROM sale_payments sp JOIN sales s ON s.id = sp.sale_id WHERE s.buyer_id = b.id),
      0
    ) AS total_paid
  FROM buyers b
  WHERE b.company_id = ? AND b.deleted_at IS NULL
  ORDER BY b.name
`;

export default function CustomerDebtReportPage() {
  const { companyId } = useCompanyId();
  const { data: rows } = useQuery<DebtRow>(QUERY, [companyId ?? ""]);

  const withBalance = (rows ?? []).filter((r) => r.total_sales - r.total_paid !== 0);

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
      <Link href="/reports" className="text-sm underline">
        {t("reports.title")}
      </Link>
      <h1 className="text-xl font-bold">{t("reports.customerDebtReport")}</h1>

      {withBalance.length === 0 && (
        <p className="text-sm text-slate-500">{t("common.noResults")}</p>
      )}

      <div className="flex flex-col gap-2">
        {withBalance.map((row) => (
          <Card key={row.buyer_id} className="flex items-center justify-between">
            <span>{row.buyer_name}</span>
            <span className="font-semibold">
              {formatCurrency(row.total_sales - row.total_paid)}
            </span>
          </Card>
        ))}
      </div>
    </main>
  );
}
