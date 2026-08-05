"use client";

import { useState } from "react";
import { usePowerSync, useQuery } from "@powersync/react";
import { t } from "@/lib/i18n";
import { useCompanyId } from "@/lib/auth/useCompanyId";
import {
  createExpenseCategory,
  updateExpenseCategory,
  softDeleteExpenseCategory,
  type ExpenseCategoryInput,
} from "@/lib/db/expenseCategories";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { PageHeader } from "@/components/ui/PageHeader";
import { ExpenseCategoryForm } from "@/components/forms/ExpenseCategoryForm";

interface ExpenseCategoryRow {
  id: string;
  name: string;
  is_default: number;
}

export default function ExpenseCategoriesPage() {
  const powersync = usePowerSync();
  const { companyId } = useCompanyId();

  const { data: rows } = useQuery<ExpenseCategoryRow>(
    "SELECT id, name, is_default FROM expense_categories WHERE company_id = ? AND deleted_at IS NULL ORDER BY name",
    [companyId ?? ""],
  );

  const [editing, setEditing] = useState<ExpenseCategoryRow | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(row: ExpenseCategoryRow) {
    setEditing(row);
    setFormOpen(true);
  }

  async function handleSubmit(input: ExpenseCategoryInput) {
    if (!companyId) return;
    if (editing) {
      await updateExpenseCategory(powersync, editing.id, input);
    } else {
      await createExpenseCategory(powersync, companyId, input);
    }
    setFormOpen(false);
  }

  async function handleConfirmDelete() {
    if (pendingDeleteId) {
      await softDeleteExpenseCategory(powersync, pendingDeleteId);
    }
    setPendingDeleteId(null);
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
      <PageHeader
        title={t("settings.expenseCategories")}
        backHref="/settings"
        action={
          <Button onClick={openCreate} className="px-3">
            {t("common.add")}
          </Button>
        }
      />

      {(!rows || rows.length === 0) && (
        <p className="text-sm text-ink-faint">{t("common.noResults")}</p>
      )}

      <div className="flex flex-col gap-2">
        {rows?.map((row) => (
          <Card key={row.id} className="flex items-center justify-between">
            <p className="font-medium">{row.name}</p>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => openEdit(row)}>
                {t("common.edit")}
              </Button>
              <Button variant="danger" onClick={() => setPendingDeleteId(row.id)}>
                {t("common.delete")}
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? t("common.edit") : t("common.add")}
      >
        <ExpenseCategoryForm
          initial={editing ? { name: editing.name } : undefined}
          onSubmit={handleSubmit}
          onCancel={() => setFormOpen(false)}
        />
      </Modal>

      <ConfirmDialog
        open={pendingDeleteId !== null}
        title={t("settings.confirmDeleteTitle")}
        message={t("settings.confirmDeleteMessage")}
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDeleteId(null)}
      />
    </main>
  );
}
