"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@powersync/react";
import { t } from "@/lib/i18n";
import { computeRemainingStock } from "@/lib/calculations/inventory";
import { Card } from "@/components/ui/Card";

interface CatchRow {
  fish_category_id: string;
  fish_quality_level_id: string;
  quantity: number;
  unit: string;
}

interface SaleRow {
  fish_category_id: string;
  fish_quality_level_id: string;
  quantity: number;
}

interface FishCategoryRow {
  id: string;
  name: string;
}

interface FishQualityLevelRow {
  id: string;
  name: string;
}

export default function TripInventoryPage() {
  const params = useParams<{ id: string }>();

  const { data: catches } = useQuery<CatchRow>(
    "SELECT fish_category_id, fish_quality_level_id, quantity, unit FROM catches WHERE trip_id = ?",
    [params.id],
  );
  const { data: sales } = useQuery<SaleRow>(
    "SELECT fish_category_id, fish_quality_level_id, quantity FROM sales WHERE trip_id = ?",
    [params.id],
  );
  const { data: categories } = useQuery<FishCategoryRow>(
    "SELECT id, name FROM fish_categories",
  );
  const { data: qualityLevels } = useQuery<FishQualityLevelRow>(
    "SELECT id, name FROM fish_quality_levels",
  );

  const stock = computeRemainingStock(
    (catches ?? []).map((c) => ({
      fishCategoryId: c.fish_category_id,
      fishQualityLevelId: c.fish_quality_level_id,
      quantity: c.quantity,
    })),
    (sales ?? []).map((s) => ({
      fishCategoryId: s.fish_category_id,
      fishQualityLevelId: s.fish_quality_level_id,
      quantity: s.quantity,
    })),
  );

  function categoryName(id: string): string {
    return categories?.find((c) => c.id === id)?.name ?? "";
  }
  function qualityName(id: string): string {
    return qualityLevels?.find((q) => q.id === id)?.name ?? "";
  }
  function unitFor(fishCategoryId: string, fishQualityLevelId: string): string {
    return (
      catches?.find(
        (c) =>
          c.fish_category_id === fishCategoryId &&
          c.fish_quality_level_id === fishQualityLevelId,
      )?.unit ?? ""
    );
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
      <Link href={`/trips/${params.id}`} className="text-sm underline">
        {t("trips.title")}
      </Link>

      <h1 className="text-xl font-bold">{t("inventory.title")}</h1>

      {stock.length === 0 && (
        <p className="text-sm text-slate-500">{t("common.noResults")}</p>
      )}

      <div className="flex flex-col gap-2">
        {stock.map((group) => (
          <Card
            key={`${group.fishCategoryId}:${group.fishQualityLevelId}`}
            className="flex items-center justify-between"
          >
            <div>
              <p className="font-medium">{categoryName(group.fishCategoryId)}</p>
              <p className="text-xs text-slate-500">
                {qualityName(group.fishQualityLevelId)}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-4 text-center text-sm">
              <div>
                <p className="text-xs text-slate-400">{t("inventory.caught")}</p>
                <p dir="ltr">
                  {group.caughtQuantity}{" "}
                  {unitFor(group.fishCategoryId, group.fishQualityLevelId)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">{t("inventory.sold")}</p>
                <p dir="ltr">
                  {group.soldQuantity}{" "}
                  {unitFor(group.fishCategoryId, group.fishQualityLevelId)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">{t("inventory.remaining")}</p>
                <p className="font-semibold" dir="ltr">
                  {group.remainingQuantity}{" "}
                  {unitFor(group.fishCategoryId, group.fishQualityLevelId)}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </main>
  );
}
