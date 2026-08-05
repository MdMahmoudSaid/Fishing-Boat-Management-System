"use client";

import Link from "next/link";
import { t } from "@/lib/i18n";
import { Card } from "@/components/ui/Card";

const REPORTS: { href: string; labelKey: Parameters<typeof t>[0] }[] = [
  { href: "/reports/boats", labelKey: "reports.boatReport" },
  { href: "/reports/trips", labelKey: "reports.tripReport" },
  { href: "/reports/expenses", labelKey: "reports.expenseReport" },
  { href: "/reports/sales", labelKey: "reports.salesReport" },
  { href: "/reports/customer-debt", labelKey: "reports.customerDebtReport" },
];

export default function ReportsPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
      <h1 className="text-xl font-bold">{t("reports.title")}</h1>
      <Card className="flex flex-col gap-3">
        {REPORTS.map((report) => (
          <Link key={report.href} href={report.href} className="underline">
            {t(report.labelKey)}
          </Link>
        ))}
      </Card>
    </main>
  );
}
