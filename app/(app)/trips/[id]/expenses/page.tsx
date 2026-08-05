"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { usePowerSync, useQuery } from "@powersync/react";
import { t } from "@/lib/i18n";
import { formatCurrency } from "@/lib/format";
import { useCompanyId } from "@/lib/auth/useCompanyId";
import { createExpense, type ExpenseInput } from "@/lib/db/expenses";
import { createExpenseCategory, type ExpenseCategoryInput } from "@/lib/db/expenseCategories";
import { queuePhotoForUpload } from "@/lib/sync/photoUploadQueue";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ExpenseForm } from "@/components/forms/ExpenseForm";
import { ExpenseCategoryForm } from "@/components/forms/ExpenseCategoryForm";

interface ExpenseRow {
  id: string;
  amount: number;
  date: string;
  description: string | null;
  category_name: string;
  photo_local_status: "none" | "pending_upload" | "uploaded" | "failed";
}

interface ExpenseCategoryOption {
  id: string;
  name: string;
}

const PHOTO_STATUS_LABEL_KEY = {
  none: null,
  pending_upload: "photoPending",
  uploaded: "photoUploaded",
  failed: "photoFailed",
} as const;

export default function TripExpensesPage() {
  const params = useParams<{ id: string }>();
  const powersync = usePowerSync();
  const { companyId } = useCompanyId();

  const { data: rows } = useQuery<ExpenseRow>(
    `SELECT e.id, e.amount, e.date, e.description, e.photo_local_status, ec.name AS category_name
     FROM expenses e JOIN expense_categories ec ON ec.id = e.expense_category_id
     WHERE e.trip_id = ?
     ORDER BY e.date DESC, e.created_at DESC`,
    [params.id],
  );

  const { data: categories } = useQuery<ExpenseCategoryOption>(
    "SELECT id, name FROM expense_categories WHERE company_id = ? AND deleted_at IS NULL ORDER BY name",
    [companyId ?? ""],
  );

  const [formOpen, setFormOpen] = useState(false);
  const [categoryFormOpen, setCategoryFormOpen] = useState(false);

  const total = (rows ?? []).reduce((sum, row) => sum + row.amount, 0);

  async function handleSubmit(input: ExpenseInput, photo: File | null) {
    if (!companyId) return;
    const expenseId = await createExpense(powersync, companyId, params.id, input);
    if (photo) {
      await queuePhotoForUpload(powersync, companyId, expenseId, photo);
    }
    setFormOpen(false);
  }

  async function handleCreateCategory(input: ExpenseCategoryInput) {
    if (!companyId) return;
    await createExpenseCategory(powersync, companyId, input);
    setCategoryFormOpen(false);
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
      <Link href={`/trips/${params.id}`} className="text-sm underline">
        {t("trips.title")}
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{t("expenses.title")}</h1>
        <Button onClick={() => setFormOpen(true)} disabled={!categories || categories.length === 0}>
          {t("common.add")}
        </Button>
      </div>

      <Card className="flex items-center justify-between">
        <span className="text-sm text-slate-500">{t("expenses.total")}</span>
        <span className="font-semibold">{formatCurrency(total)}</span>
      </Card>

      {(!rows || rows.length === 0) && (
        <p className="text-sm text-slate-500">{t("common.noResults")}</p>
      )}

      <div className="flex flex-col gap-2">
        {rows?.map((row) => {
          const statusKey = PHOTO_STATUS_LABEL_KEY[row.photo_local_status];
          return (
            <Card key={row.id} className="flex items-center justify-between">
              <div>
                <p className="font-medium">{row.category_name}</p>
                <p className="text-xs text-slate-500" dir="ltr">
                  {row.date}
                </p>
                {row.description && <p className="text-sm">{row.description}</p>}
              </div>
              <div className="text-end">
                <p className="font-medium">{formatCurrency(row.amount)}</p>
                {statusKey && (
                  <p className="text-xs text-slate-400">{t(`expenses.${statusKey}`)}</p>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={t("common.add")}>
        <ExpenseForm
          categories={categories ?? []}
          onAddCategoryClick={() => setCategoryFormOpen(true)}
          onSubmit={handleSubmit}
          onCancel={() => setFormOpen(false)}
        />
      </Modal>

      <Modal
        open={categoryFormOpen}
        onClose={() => setCategoryFormOpen(false)}
        title={t("expenses.addCategory")}
      >
        <ExpenseCategoryForm
          onSubmit={handleCreateCategory}
          onCancel={() => setCategoryFormOpen(false)}
        />
      </Modal>
    </main>
  );
}
