"use client";

import Link from "next/link";
import { useQuery } from "@powersync/react";
import { t } from "@/lib/i18n";
import { formatCurrency } from "@/lib/format";
import { useCompanyId } from "@/lib/auth/useCompanyId";
import { Card } from "@/components/ui/Card";

interface ExpenseReportRow {
  category_name: string;
  total: number;
  count: number;
}

const QUERY = `
  SELECT ec.name AS category_name, SUM(e.amount) AS total, COUNT(*) AS count
  FROM expenses e
  JOIN expense_categories ec ON ec.id = e.expense_category_id
  WHERE e.company_id = ?
  GROUP BY e.expense_category_id
  ORDER BY total DESC
`;

export default function ExpenseReportPage() {
  const { companyId } = useCompanyId();
  const { data: rows } = useQuery<ExpenseReportRow>(QUERY, [companyId ?? ""]);

  const grandTotal = (rows ?? []).reduce((sum, row) => sum + row.total, 0);

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
      <Link href="/reports" className="text-sm underline">
        {t("reports.title")}
      </Link>
      <h1 className="text-xl font-bold">{t("reports.expenseReport")}</h1>

      <Card className="flex items-center justify-between">
        <span className="text-sm text-slate-500">{t("expenses.total")}</span>
        <span className="font-semibold">{formatCurrency(grandTotal)}</span>
      </Card>

      {(!rows || rows.length === 0) && (
        <p className="text-sm text-slate-500">{t("common.noResults")}</p>
      )}

      <div className="flex flex-col gap-2">
        {rows?.map((row) => (
          <Card key={row.category_name} className="flex items-center justify-between">
            <div>
              <p className="font-medium">{row.category_name}</p>
              <p className="text-xs text-slate-500" dir="ltr">
                {row.count}
              </p>
            </div>
            <span className="font-semibold">{formatCurrency(row.total)}</span>
          </Card>
        ))}
      </div>
    </main>
  );
}
