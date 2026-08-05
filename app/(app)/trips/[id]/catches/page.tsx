"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { usePowerSync, useQuery } from "@powersync/react";
import { t } from "@/lib/i18n";
import { useCompanyId } from "@/lib/auth/useCompanyId";
import { createCatch, type CatchInput } from "@/lib/db/catches";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { CatchForm } from "@/components/forms/CatchForm";

interface CatchRow {
  id: string;
  quantity: number;
  unit: string;
  estimated_price: number | null;
  fish_category_name: string;
  fish_quality_level_name: string;
}

interface CatchSummaryRow {
  fish_category_name: string;
  fish_quality_level_name: string;
  unit: string;
  total_quantity: number;
}

interface FishCategoryOption {
  id: string;
  name: string;
  default_unit: string;
}

interface FishQualityLevelOption {
  id: string;
  fish_category_id: string;
  name: string;
}

export default function TripCatchesPage() {
  const params = useParams<{ id: string }>();
  const powersync = usePowerSync();
  const { companyId } = useCompanyId();

  const { data: rows } = useQuery<CatchRow>(
    `SELECT c.id, c.quantity, c.unit, c.estimated_price, fc.name AS fish_category_name, fq.name AS fish_quality_level_name
     FROM catches c
     JOIN fish_categories fc ON fc.id = c.fish_category_id
     JOIN fish_quality_levels fq ON fq.id = c.fish_quality_level_id
     WHERE c.trip_id = ?
     ORDER BY c.created_at DESC`,
    [params.id],
  );

  const { data: summary } = useQuery<CatchSummaryRow>(
    `SELECT fc.name AS fish_category_name, fq.name AS fish_quality_level_name, c.unit, SUM(c.quantity) AS total_quantity
     FROM catches c
     JOIN fish_categories fc ON fc.id = c.fish_category_id
     JOIN fish_quality_levels fq ON fq.id = c.fish_quality_level_id
     WHERE c.trip_id = ?
     GROUP BY c.fish_category_id, c.fish_quality_level_id, c.unit
     ORDER BY fc.name, fq.name`,
    [params.id],
  );

  const { data: categories } = useQuery<FishCategoryOption>(
    "SELECT id, name, default_unit FROM fish_categories WHERE company_id = ? AND deleted_at IS NULL ORDER BY name",
    [companyId ?? ""],
  );

  const { data: qualityLevels } = useQuery<FishQualityLevelOption>(
    "SELECT id, fish_category_id, name FROM fish_quality_levels WHERE company_id = ? AND deleted_at IS NULL ORDER BY name",
    [companyId ?? ""],
  );

  const [formOpen, setFormOpen] = useState(false);

  async function handleSubmit(input: CatchInput) {
    if (!companyId) return;
    await createCatch(powersync, companyId, params.id, input);
    setFormOpen(false);
  }

  const canAdd = (categories?.length ?? 0) > 0 && (qualityLevels?.length ?? 0) > 0;

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
      <Link href={`/trips/${params.id}`} className="text-sm underline">
        {t("trips.title")}
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{t("catches.title")}</h1>
        <Button onClick={() => setFormOpen(true)} disabled={!canAdd}>
          {t("common.add")}
        </Button>
      </div>

      {summary && summary.length > 0 && (
        <Card className="flex flex-col gap-2">
          <span className="text-sm font-medium text-slate-500">{t("catches.total")}</span>
          {summary.map((row, index) => (
            <div key={index} className="flex justify-between text-sm">
              <span>
                {row.fish_category_name} — {row.fish_quality_level_name}
              </span>
              <span dir="ltr">
                {row.total_quantity} {row.unit}
              </span>
            </div>
          ))}
        </Card>
      )}

      {(!rows || rows.length === 0) && (
        <p className="text-sm text-slate-500">{t("common.noResults")}</p>
      )}

      <div className="flex flex-col gap-2">
        {rows?.map((row) => (
          <Card key={row.id} className="flex items-center justify-between">
            <div>
              <p className="font-medium">{row.fish_category_name}</p>
              <p className="text-xs text-slate-500">{row.fish_quality_level_name}</p>
            </div>
            <span dir="ltr">
              {row.quantity} {row.unit}
            </span>
          </Card>
        ))}
      </div>

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={t("common.add")}>
        <CatchForm
          categories={(categories ?? []).map((c) => ({
            id: c.id,
            name: c.name,
            defaultUnit: c.default_unit,
          }))}
          qualityLevels={(qualityLevels ?? []).map((q) => ({
            id: q.id,
            fishCategoryId: q.fish_category_id,
            name: q.name,
          }))}
          onSubmit={handleSubmit}
          onCancel={() => setFormOpen(false)}
        />
      </Modal>
    </main>
  );
}
