"use client";

import { useState } from "react";
import { usePowerSync, useQuery } from "@powersync/react";
import { t } from "@/lib/i18n";
import { useCompanyId } from "@/lib/auth/useCompanyId";
import {
  createFishCategory,
  updateFishCategory,
  softDeleteFishCategory,
  type FishCategoryInput,
} from "@/lib/db/fishCategories";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { PageHeader } from "@/components/ui/PageHeader";
import { FishCategoryForm } from "@/components/forms/FishCategoryForm";

interface FishCategoryRow {
  id: string;
  name: string;
  default_unit: string;
  notes: string | null;
}

export default function FishCategoriesPage() {
  const powersync = usePowerSync();
  const { companyId } = useCompanyId();

  const { data: rows } = useQuery<FishCategoryRow>(
    "SELECT id, name, default_unit, notes FROM fish_categories WHERE company_id = ? AND deleted_at IS NULL ORDER BY name",
    [companyId ?? ""],
  );

  const [editing, setEditing] = useState<FishCategoryRow | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(row: FishCategoryRow) {
    setEditing(row);
    setFormOpen(true);
  }

  async function handleSubmit(input: FishCategoryInput) {
    if (!companyId) return;
    if (editing) {
      await updateFishCategory(powersync, editing.id, input);
    } else {
      await createFishCategory(powersync, companyId, input);
    }
    setFormOpen(false);
  }

  async function handleConfirmDelete() {
    if (pendingDeleteId) {
      await softDeleteFishCategory(powersync, pendingDeleteId);
    }
    setPendingDeleteId(null);
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
      <PageHeader
        title={t("settings.fishCategories")}
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
            <div>
              <p className="font-medium">{row.name}</p>
              <p className="text-xs text-ink-faint">{row.default_unit}</p>
            </div>
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
        <FishCategoryForm
          initial={
            editing
              ? {
                  name: editing.name,
                  defaultUnit: editing.default_unit,
                  notes: editing.notes,
                }
              : undefined
          }
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
