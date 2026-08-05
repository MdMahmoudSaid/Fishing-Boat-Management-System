"use client";

import Link from "next/link";
import { ChevronLeft, FileBarChart2 } from "lucide-react";
import { t } from "@/lib/i18n";
import { PageHeader } from "@/components/ui/PageHeader";

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
      <PageHeader title={t("reports.title")} backHref="/" />
      <div className="flex flex-col divide-y divide-sand-dim overflow-hidden rounded-2xl border border-sand-dim bg-foam shadow-[0_1px_2px_rgba(11,18,32,0.04)] dark:divide-white/10 dark:border-white/10 dark:bg-white/5">
        {REPORTS.map((report) => (
          <Link
            key={report.href}
            href={report.href}
            className="flex items-center gap-3 px-4 py-3.5 text-sm text-ink transition-colors hover:bg-sand dark:text-sand dark:hover:bg-white/5"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rope-soft text-rope dark:bg-white/10">
              <FileBarChart2 size={16} />
            </span>
            <span className="flex-1 font-medium">{t(report.labelKey)}</span>
            <ChevronLeft size={16} className="text-ink-faint" />
          </Link>
        ))}
      </div>
    </main>
  );
}
