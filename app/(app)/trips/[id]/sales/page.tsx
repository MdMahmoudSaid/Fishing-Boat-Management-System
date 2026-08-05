"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { usePowerSync, useQuery } from "@powersync/react";
import { t } from "@/lib/i18n";
import { formatCurrency } from "@/lib/format";
import { useCompanyId } from "@/lib/auth/useCompanyId";
import { computeRemainingStock } from "@/lib/calculations/inventory";
import { createSale, type SaleInput } from "@/lib/db/sales";
import { createSalePayment, type SalePaymentInput } from "@/lib/db/salePayments";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { SaleForm, type StockOption } from "@/components/forms/SaleForm";
import { SalePaymentForm } from "@/components/forms/SalePaymentForm";

interface CatchStockRow {
  fish_category_id: string;
  fish_quality_level_id: string;
  quantity: number;
  unit: string;
}

interface SaleStockRow {
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

interface BuyerRow {
  id: string;
  name: string;
}

interface SaleRow {
  id: string;
  quantity: number;
  sale_price: number;
  total_amount: number;
  date: string;
  buyer_name: string;
  fish_category_name: string;
  fish_quality_level_name: string;
}

interface PaidRow {
  sale_id: string;
  paid: number;
}

export default function TripSalesPage() {
  const params = useParams<{ id: string }>();
  const powersync = usePowerSync();
  const { companyId } = useCompanyId();

  const { data: catches } = useQuery<CatchStockRow>(
    "SELECT fish_category_id, fish_quality_level_id, quantity, unit FROM catches WHERE trip_id = ?",
    [params.id],
  );
  const { data: salesStock } = useQuery<SaleStockRow>(
    "SELECT fish_category_id, fish_quality_level_id, quantity FROM sales WHERE trip_id = ?",
    [params.id],
  );
  const { data: categories } = useQuery<FishCategoryRow>(
    "SELECT id, name FROM fish_categories",
  );
  const { data: qualityLevels } = useQuery<FishQualityLevelRow>(
    "SELECT id, name FROM fish_quality_levels",
  );
  const { data: buyers } = useQuery<BuyerRow>(
    "SELECT id, name FROM buyers WHERE company_id = ? AND deleted_at IS NULL ORDER BY name",
    [companyId ?? ""],
  );
  const { data: sales } = useQuery<SaleRow>(
    `SELECT s.id, s.quantity, s.sale_price, s.total_amount, s.date,
            b.name AS buyer_name, fc.name AS fish_category_name, fq.name AS fish_quality_level_name
     FROM sales s
     JOIN buyers b ON b.id = s.buyer_id
     JOIN fish_categories fc ON fc.id = s.fish_category_id
     JOIN fish_quality_levels fq ON fq.id = s.fish_quality_level_id
     WHERE s.trip_id = ?
     ORDER BY s.date DESC, s.created_at DESC`,
    [params.id],
  );
  const { data: paidRows } = useQuery<PaidRow>(
    `SELECT sp.sale_id, SUM(sp.amount) AS paid
     FROM sale_payments sp
     JOIN sales s ON s.id = sp.sale_id
     WHERE s.trip_id = ?
     GROUP BY sp.sale_id`,
    [params.id],
  );

  const stock = computeRemainingStock(
    (catches ?? []).map((c) => ({
      fishCategoryId: c.fish_category_id,
      fishQualityLevelId: c.fish_quality_level_id,
      quantity: c.quantity,
    })),
    (salesStock ?? []).map((s) => ({
      fishCategoryId: s.fish_category_id,
      fishQualityLevelId: s.fish_quality_level_id,
      quantity: s.quantity,
    })),
  );

  const stockOptions: StockOption[] = stock
    .filter((group) => group.remainingQuantity > 0)
    .map((group) => {
      const categoryName =
        categories?.find((c) => c.id === group.fishCategoryId)?.name ?? "";
      const qualityName =
        qualityLevels?.find((q) => q.id === group.fishQualityLevelId)?.name ?? "";
      const unit =
        catches?.find(
          (c) =>
            c.fish_category_id === group.fishCategoryId &&
            c.fish_quality_level_id === group.fishQualityLevelId,
        )?.unit ?? "";
      return {
        fishCategoryId: group.fishCategoryId,
        fishQualityLevelId: group.fishQualityLevelId,
        unit,
        remainingQuantity: group.remainingQuantity,
        label: `${categoryName} — ${qualityName} (${group.remainingQuantity} ${unit})`,
      };
    });

  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentSaleId, setPaymentSaleId] = useState<string | null>(null);

  async function handleSubmit(input: SaleInput) {
    if (!companyId) return;
    setError(null);
    try {
      await createSale(powersync, companyId, params.id, input);
      setFormOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handlePaymentSubmit(input: SalePaymentInput) {
    if (!companyId || !paymentSaleId) return;
    await createSalePayment(powersync, companyId, paymentSaleId, input);
    setPaymentSaleId(null);
  }

  function paidFor(saleId: string): number {
    return paidRows?.find((p) => p.sale_id === saleId)?.paid ?? 0;
  }

  const activeSale = sales?.find((s) => s.id === paymentSaleId);

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
      <Link href={`/trips/${params.id}`} className="text-sm underline">
        {t("trips.title")}
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{t("sales.title")}</h1>
        <Button
          onClick={() => {
            setError(null);
            setFormOpen(true);
          }}
          disabled={!buyers || buyers.length === 0 || stockOptions.length === 0}
        >
          {t("common.add")}
        </Button>
      </div>

      {stockOptions.length === 0 && (
        <p className="text-sm text-slate-500">{t("sales.noStockAvailable")}</p>
      )}

      {(!sales || sales.length === 0) && (
        <p className="text-sm text-slate-500">{t("common.noResults")}</p>
      )}

      <div className="flex flex-col gap-2">
        {sales?.map((sale) => {
          const paid = paidFor(sale.id);
          const outstanding = sale.total_amount - paid;
          return (
            <Card key={sale.id} className="flex flex-col gap-2">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">{sale.buyer_name}</p>
                  <p className="text-xs text-slate-500">
                    {sale.fish_category_name} — {sale.fish_quality_level_name}
                  </p>
                  <p className="text-xs text-slate-500" dir="ltr">
                    {sale.date}
                  </p>
                </div>
                <p className="font-semibold">{formatCurrency(sale.total_amount)}</p>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">
                  {t("sales.paid")}: {formatCurrency(paid)} — {t("sales.outstanding")}:{" "}
                  {formatCurrency(outstanding)}
                </span>
                {outstanding > 0 && (
                  <Button variant="secondary" onClick={() => setPaymentSaleId(sale.id)}>
                    {t("sales.addPayment")}
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={t("common.add")}>
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        <SaleForm
          buyers={buyers ?? []}
          stockOptions={stockOptions}
          onSubmit={handleSubmit}
          onCancel={() => setFormOpen(false)}
        />
      </Modal>

      <Modal
        open={paymentSaleId !== null}
        onClose={() => setPaymentSaleId(null)}
        title={t("sales.addPayment")}
      >
        <SalePaymentForm
          maxAmount={
            activeSale ? activeSale.total_amount - paidFor(activeSale.id) : undefined
          }
          onSubmit={handlePaymentSubmit}
          onCancel={() => setPaymentSaleId(null)}
        />
      </Modal>
    </main>
  );
}
