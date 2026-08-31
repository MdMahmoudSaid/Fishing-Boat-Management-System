"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { t } from "@/lib/i18n";
import { adminFetch } from "@/lib/admin/adminFetch";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface CompanyListItem {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  owner_name: string | null;
  owner_phone: string | null;
}

export default function AdminCompaniesPage() {
  const [companies, setCompanies] = useState<CompanyListItem[] | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ q: search.trim() });
    adminFetch<{ companies: CompanyListItem[] }>(`/api/admin/companies?${params}`)
      .then((data) => {
        if (!cancelled) setCompanies(data.companies);
      })
      .catch(() => {
        if (!cancelled) setCompanies([]);
      });
    return () => {
      cancelled = true;
    };
  }, [search]);

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-lg font-semibold text-ink dark:text-sand">
          {t("admin.companiesTitle")}
        </h1>
        <Link href="/admin/companies/new">
          <Button className="px-3">{t("admin.addCompany")}</Button>
        </Link>
      </div>

      <div className="relative">
        <Search size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-faint" />
        <Input
          placeholder={t("filters.search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ps-9"
        />
      </div>

      {companies && companies.length === 0 && (
        <p className="py-6 text-center text-sm text-ink-faint">{t("common.noResults")}</p>
      )}

      <div className="flex flex-col gap-2">
        {companies?.map((company) => (
          <Link key={company.id} href={`/admin/companies/${company.id}`}>
            <Card className="flex items-center justify-between gap-3">
              <div>
                <p className="font-display text-base font-semibold text-ink dark:text-sand">
                  {company.name}
                </p>
                <p className="text-xs text-ink-faint">
                  {company.owner_name ?? t("admin.noOwner")}
                  {company.owner_phone ? ` · ${company.owner_phone}` : ""}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
                  company.is_active ? "bg-success-soft text-success" : "bg-danger-soft text-danger"
                }`}
              >
                {t(company.is_active ? "admin.active" : "admin.inactive")}
              </span>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
