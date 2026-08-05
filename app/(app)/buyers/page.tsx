"use client";

import { useState } from "react";
import { usePowerSync, useQuery } from "@powersync/react";
import { t } from "@/lib/i18n";
import { useCompanyId } from "@/lib/auth/useCompanyId";
import {
  createBuyer,
  updateBuyer,
  softDeleteBuyer,
  type BuyerInput,
} from "@/lib/db/buyers";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { BuyerForm } from "@/components/forms/BuyerForm";

interface BuyerRow {
  id: string;
  name: string;
  phone: string | null;
  notes: string | null;
}

export default function BuyersPage() {
  const powersync = usePowerSync();
  const { companyId } = useCompanyId();

  const { data: rows } = useQuery<BuyerRow>(
    "SELECT id, name, phone, notes FROM buyers WHERE company_id = ? AND deleted_at IS NULL ORDER BY name",
    [companyId ?? ""],
  );

  const [editing, setEditing] = useState<BuyerRow | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(row: BuyerRow) {
    setEditing(row);
    setFormOpen(true);
  }

  async function handleSubmit(input: BuyerInput) {
    if (!companyId) return;
    if (editing) {
      await updateBuyer(powersync, editing.id, input);
    } else {
      await createBuyer(powersync, companyId, input);
    }
    setFormOpen(false);
  }

  async function handleConfirmDelete() {
    if (pendingDeleteId) {
      await softDeleteBuyer(powersync, pendingDeleteId);
    }
    setPendingDeleteId(null);
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{t("buyers.title")}</h1>
        <Button onClick={openCreate}>{t("common.add")}</Button>
      </div>

      {(!rows || rows.length === 0) && (
        <p className="text-sm text-slate-500">{t("common.noResults")}</p>
      )}

      <div className="flex flex-col gap-2">
        {rows?.map((row) => (
          <Card key={row.id} className="flex items-center justify-between">
            <div>
              <p className="font-medium">{row.name}</p>
              {row.phone && (
                <p className="text-xs text-slate-500" dir="ltr">
                  {row.phone}
                </p>
              )}
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
        <BuyerForm
          initial={
            editing
              ? { name: editing.name, phone: editing.phone, notes: editing.notes }
              : undefined
          }
          onSubmit={handleSubmit}
          onCancel={() => setFormOpen(false)}
        />
      </Modal>

      <ConfirmDialog
        open={pendingDeleteId !== null}
        title={t("settings.confirmDeleteTitle")}
        message={t("buyers.confirmDeleteMessage")}
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDeleteId(null)}
      />
    </main>
  );
}
