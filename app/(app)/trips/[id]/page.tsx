"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { Wallet, Fish, ShoppingCart, Package } from "lucide-react";
import { usePowerSync, useQuery } from "@powersync/react";
import { t } from "@/lib/i18n";
import { formatCurrency } from "@/lib/format";
import { useCompanyId } from "@/lib/auth/useCompanyId";
import {
  updateTrip,
  advanceTripStatus,
  softDeleteTrip,
  type TripInput,
  type TripEditableFields,
} from "@/lib/db/trips";
import {
  addTripCrewMember,
  removeTripCrewMember,
  type TripCrewInput,
} from "@/lib/db/tripCrew";
import { nextTripStatus, TripValidationError, type TripStatus } from "@/lib/calculations/tripValidation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { PageHeader } from "@/components/ui/PageHeader";
import { TripForm } from "@/components/forms/TripForm";
import { TripCrewAssignmentForm } from "@/components/forms/TripCrewAssignmentForm";

interface TripRow {
  id: string;
  boat_id: string;
  boat_name: string;
  captain_name: string | null;
  departure_date: string;
  expected_return_date: string | null;
  actual_return_date: string | null;
  status: TripStatus;
  crew_payment_method: TripInput["crewPaymentMethod"];
  notes: string | null;
}

interface TripCrewRow {
  id: string;
  crew_member_id: string;
  crew_member_name: string;
  payment_type: "fixed" | "percentage";
  fixed_amount: number | null;
  percentage: number | null;
  computed_amount: number | null;
}

interface CrewMemberOption {
  id: string;
  name: string;
}

const STATUS_LABEL_KEY = {
  preparing: "statusPreparing",
  at_sea: "statusAtSea",
  returned: "statusReturned",
  closed: "statusClosed",
} as const;

const STATUS_BADGE_CLASS: Record<TripStatus, string> = {
  preparing: "bg-sand-dim text-ink-soft dark:bg-white/10 dark:text-sand/70",
  at_sea: "bg-sea-soft text-sea",
  returned: "bg-rope-soft text-rope-dark",
  closed: "bg-success-soft text-success",
};

export default function TripDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const powersync = usePowerSync();
  const { companyId } = useCompanyId();

  const { data: tripRows } = useQuery<TripRow>(
    `SELECT t.id, t.boat_id, b.name AS boat_name, t.captain_name, t.departure_date,
            t.expected_return_date, t.actual_return_date, t.status, t.crew_payment_method, t.notes
     FROM trips t JOIN boats b ON b.id = t.boat_id
     WHERE t.id = ?`,
    [params.id],
  );
  const trip = tripRows?.[0];

  const { data: crewRows } = useQuery<TripCrewRow>(
    `SELECT tc.id, tc.crew_member_id, cm.name AS crew_member_name, tc.payment_type,
            tc.fixed_amount, tc.percentage, tc.computed_amount
     FROM trip_crew tc JOIN crew_members cm ON cm.id = tc.crew_member_id
     WHERE tc.trip_id = ?
     ORDER BY cm.name`,
    [params.id],
  );

  const { data: allCrewMembers } = useQuery<CrewMemberOption>(
    "SELECT id, name FROM crew_members WHERE company_id = ? AND deleted_at IS NULL ORDER BY name",
    [companyId ?? ""],
  );

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [returnDateOpen, setReturnDateOpen] = useState(false);
  const [returnDate, setReturnDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [crewFormOpen, setCrewFormOpen] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  if (!trip) {
    return (
      <main className="p-6">
        <p className="text-sm text-ink-faint">{t("common.loading")}</p>
      </main>
    );
  }

  const next = nextTripStatus(trip.status);
  const assignedCrewMemberIds = new Set(crewRows?.map((c) => c.crew_member_id));
  const availableCrewMembers = (allCrewMembers ?? []).filter(
    (c) => !assignedCrewMemberIds.has(c.id),
  );

  async function handleEditSubmit(input: TripInput) {
    const editable: TripEditableFields = {
      captainName: input.captainName,
      departureDate: input.departureDate,
      expectedReturnDate: input.expectedReturnDate,
      crewPaymentMethod: input.crewPaymentMethod,
      notes: input.notes,
    };
    await updateTrip(powersync, trip!.id, editable);
    setEditOpen(false);
  }

  async function handleDelete() {
    await softDeleteTrip(powersync, { id: trip!.id, boatId: trip!.boat_id });
    setDeleteOpen(false);
    router.push("/trips");
  }

  async function handleAdvance() {
    if (!trip || !next) return;
    setStatusError(null);
    if (next === "returned") {
      setReturnDateOpen(true);
      return;
    }
    try {
      await advanceTripStatus(powersync, {
        id: trip.id,
        boatId: trip.boat_id,
        status: trip.status,
        actualReturnDate: trip.actual_return_date,
        crewPaymentMethod: trip.crew_payment_method,
      });
    } catch (err) {
      setStatusError(err instanceof TripValidationError ? err.message : String(err));
    }
  }

  async function handleConfirmReturnDate() {
    if (!trip) return;
    try {
      await advanceTripStatus(
        powersync,
        {
          id: trip.id,
          boatId: trip.boat_id,
          status: trip.status,
          actualReturnDate: trip.actual_return_date,
          crewPaymentMethod: trip.crew_payment_method,
        },
        { actualReturnDate: returnDate },
      );
      setReturnDateOpen(false);
    } catch (err) {
      setStatusError(err instanceof TripValidationError ? err.message : String(err));
      setReturnDateOpen(false);
    }
  }

  async function handleAddCrewMember(input: TripCrewInput) {
    if (!companyId || !trip) return;
    await addTripCrewMember(powersync, companyId, trip.id, input);
    setCrewFormOpen(false);
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
      <PageHeader
        title={trip.boat_name}
        backHref="/trips"
        action={
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_BADGE_CLASS[trip.status]}`}
          >
            {t(`trips.${STATUS_LABEL_KEY[trip.status]}`)}
          </span>
        }
      />

      <Card className="flex flex-col gap-2">
        {trip.captain_name && (
          <p className="text-sm text-ink-faint">{trip.captain_name}</p>
        )}

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-xs text-ink-faint">{t("trips.departureDate")}</p>
            <p dir="ltr">{trip.departure_date}</p>
          </div>
          {trip.expected_return_date && (
            <div>
              <p className="text-xs text-ink-faint">{t("trips.expectedReturnDate")}</p>
              <p dir="ltr">{trip.expected_return_date}</p>
            </div>
          )}
          {trip.actual_return_date && (
            <div>
              <p className="text-xs text-ink-faint">{t("trips.actualReturnDate")}</p>
              <p dir="ltr">{trip.actual_return_date}</p>
            </div>
          )}
        </div>

        {trip.notes && <p className="text-sm">{trip.notes}</p>}

        {statusError && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{statusError}</p>}

        <div className="mt-2 flex flex-wrap gap-2">
          {next && (
            <Button onClick={handleAdvance}>
              {t("trips.advanceTo")}: {t(`trips.${STATUS_LABEL_KEY[next]}`)}
            </Button>
          )}
          <Button variant="secondary" onClick={() => setEditOpen(true)}>
            {t("common.edit")}
          </Button>
          <Button variant="danger" onClick={() => setDeleteOpen(true)}>
            {t("common.delete")}
          </Button>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { href: `/trips/${trip.id}/expenses`, label: t("expenses.title"), icon: Wallet },
            { href: `/trips/${trip.id}/catches`, label: t("catches.title"), icon: Fish },
            { href: `/trips/${trip.id}/sales`, label: t("sales.title"), icon: ShoppingCart },
            { href: `/trips/${trip.id}/inventory`, label: t("inventory.title"), icon: Package },
          ].map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className="flex flex-col items-center gap-1.5 rounded-xl bg-sand px-2 py-3 text-center text-xs font-medium text-ink-soft transition-colors hover:bg-rope-soft hover:text-rope-dark dark:bg-white/5 dark:text-sand/70 dark:hover:bg-white/10"
              >
                <Icon size={18} />
                {link.label}
              </Link>
            );
          })}
        </div>
      </Card>

      <Card className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{t("trips.crewSection")}</h2>
          <Button
            variant="secondary"
            onClick={() => setCrewFormOpen(true)}
            disabled={availableCrewMembers.length === 0}
          >
            {t("trips.addCrewMember")}
          </Button>
        </div>

        {(!crewRows || crewRows.length === 0) && (
          <p className="text-sm text-ink-faint">{t("common.noResults")}</p>
        )}

        {crewRows?.map((row) => (
          <div key={row.id} className="flex items-center justify-between border-t border-sand-dim pt-2 dark:border-white/10">
            <div>
              <p className="font-medium">{row.crew_member_name}</p>
              <p className="text-xs text-ink-faint">
                {row.payment_type === "fixed"
                  ? formatCurrency(row.fixed_amount ?? 0)
                  : `${row.percentage ?? 0}%`}
                {row.computed_amount != null &&
                  ` — ${formatCurrency(row.computed_amount)}`}
              </p>
            </div>
            <Button
              variant="danger"
              onClick={() => removeTripCrewMember(powersync, row.id)}
            >
              {t("trips.remove")}
            </Button>
          </div>
        ))}
      </Card>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title={t("common.edit")}>
        <TripForm
          boats={[{ id: trip.boat_id, name: trip.boat_name }]}
          boatLocked
          defaultCrewPaymentMethod={trip.crew_payment_method}
          initial={{
            boatId: trip.boat_id,
            captainName: trip.captain_name,
            departureDate: trip.departure_date,
            expectedReturnDate: trip.expected_return_date,
            crewPaymentMethod: trip.crew_payment_method,
            notes: trip.notes,
          }}
          onSubmit={handleEditSubmit}
          onCancel={() => setEditOpen(false)}
        />
      </Modal>

      <Modal
        open={crewFormOpen}
        onClose={() => setCrewFormOpen(false)}
        title={t("trips.addCrewMember")}
      >
        <TripCrewAssignmentForm
          crewMembers={availableCrewMembers}
          onSubmit={handleAddCrewMember}
          onCancel={() => setCrewFormOpen(false)}
        />
      </Modal>

      <Modal
        open={returnDateOpen}
        onClose={() => setReturnDateOpen(false)}
        title={t("trips.actualReturnDate")}
      >
        <div className="flex flex-col gap-4">
          <Input
            label={t("trips.actualReturnDate")}
            type="date"
            value={returnDate}
            onChange={(e) => setReturnDate(e.target.value)}
            dir="ltr"
            required
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setReturnDateOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleConfirmReturnDate}>{t("common.confirm")}</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteOpen}
        title={t("settings.confirmDeleteTitle")}
        message={t("trips.confirmDeleteMessage")}
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
      />
    </main>
  );
}
