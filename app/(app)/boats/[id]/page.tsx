"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { usePowerSync, useQuery } from "@powersync/react";
import { t } from "@/lib/i18n";
import {
  updateBoat,
  softDeleteBoat,
  type BoatInput,
  type BoatStatus,
} from "@/lib/db/boats";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { PageHeader } from "@/components/ui/PageHeader";
import { BoatForm } from "@/components/forms/BoatForm";

interface BoatRow {
  id: string;
  name: string;
  registration_number: string | null;
  captain_name: string | null;
  notes: string | null;
  status: BoatStatus;
}

export default function BoatDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const powersync = usePowerSync();

  const { data: rows } = useQuery<BoatRow>(
    "SELECT id, name, registration_number, captain_name, notes, status FROM boats WHERE id = ?",
    [params.id],
  );
  const boat = rows?.[0];

  const [formOpen, setFormOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  async function handleSubmit(input: BoatInput) {
    await updateBoat(powersync, params.id, input);
    setFormOpen(false);
  }

  async function handleConfirmDelete() {
    await softDeleteBoat(powersync, params.id);
    setConfirmDeleteOpen(false);
    router.push("/boats");
  }

  if (!boat) {
    return (
      <main className="p-6">
        <p className="text-sm text-ink-faint">{t("common.loading")}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
      <PageHeader title={boat.name} backHref="/boats" />

      <Card className="flex flex-col gap-2">
        {boat.registration_number && (
          <p className="text-sm text-ink-faint" dir="ltr">
            {boat.registration_number}
          </p>
        )}
        {boat.captain_name && (
          <p className="text-sm text-ink-faint">{boat.captain_name}</p>
        )}
        {boat.notes && <p className="text-sm">{boat.notes}</p>}

        <div className="mt-2 flex gap-2">
          <Button variant="secondary" onClick={() => setFormOpen(true)}>
            {t("common.edit")}
          </Button>
          <Button variant="danger" onClick={() => setConfirmDeleteOpen(true)}>
            {t("common.delete")}
          </Button>
        </div>
      </Card>

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={t("common.edit")}>
        <BoatForm
          initial={{
            name: boat.name,
            registrationNumber: boat.registration_number,
            captainName: boat.captain_name,
            notes: boat.notes,
            status: boat.status,
          }}
          onSubmit={handleSubmit}
          onCancel={() => setFormOpen(false)}
        />
      </Modal>

      <ConfirmDialog
        open={confirmDeleteOpen}
        title={t("settings.confirmDeleteTitle")}
        message={t("boats.confirmDeleteMessage")}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
    </main>
  );
}
