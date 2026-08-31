"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { t } from "@/lib/i18n";
import { adminFetch, AdminFetchError } from "@/lib/admin/adminFetch";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { PhoneInput } from "@/components/ui/PhoneInput";
import { CodeInput } from "@/components/ui/CodeInput";
import { isValidLoginCode, isValidMauritanianPhone } from "@/lib/auth/phoneAuth";

interface CompanyDetail {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  owner_id: string | null;
  owner_name: string | null;
  owner_phone: string | null;
}

export default function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [company, setCompany] = useState<CompanyDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [confirmToggleOpen, setConfirmToggleOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  const load = useCallback(() => {
    adminFetch<{ company: CompanyDetail }>(`/api/admin/companies/${id}`)
      .then((data) => setCompany(data.company))
      .catch((err) => {
        if (err instanceof AdminFetchError && err.status === 404) setNotFound(true);
      });
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleToggleActive() {
    if (!company) return;
    await adminFetch(`/api/admin/companies/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ isActive: !company.is_active }),
    });
    setConfirmToggleOpen(false);
    load();
  }

  if (notFound) {
    return (
      <>
        <PageHeader title={t("admin.detailTitle")} backHref="/admin/companies" />
        <p className="py-6 text-center text-sm text-ink-faint">{t("admin.notFound")}</p>
      </>
    );
  }

  if (!company) return null;

  return (
    <>
      <PageHeader title={company.name} backHref="/admin/companies" />

      <Card className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-sm text-ink-faint">{t("admin.createdAt")}</p>
          <p className="text-sm text-ink dark:text-sand">
            {new Date(company.created_at).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-sm text-ink-faint">{t("admin.status")}</p>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              company.is_active ? "bg-success-soft text-success" : "bg-danger-soft text-danger"
            }`}
          >
            {t(company.is_active ? "admin.active" : "admin.inactive")}
          </span>
        </div>
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-ink dark:text-sand">{t("admin.ownerSection")}</h2>
        <div className="flex items-center justify-between">
          <p className="text-sm text-ink-faint">{t("admin.ownerName")}</p>
          <p className="text-sm text-ink dark:text-sand">{company.owner_name ?? t("admin.noOwner")}</p>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-sm text-ink-faint">{t("admin.ownerPhone")}</p>
          <p className="text-sm text-ink dark:text-sand" dir="ltr">
            {company.owner_phone ?? "—"}
          </p>
        </div>
      </Card>

      <div className="flex flex-col gap-2">
        <Button variant="secondary" onClick={() => setResetOpen(true)} disabled={!company.owner_id}>
          {t("admin.resetCredentials")}
        </Button>
        <Button variant="danger" onClick={() => setConfirmToggleOpen(true)}>
          {t(company.is_active ? "admin.deactivate" : "admin.reactivate")}
        </Button>
      </div>

      <ConfirmDialog
        open={confirmToggleOpen}
        title={t(company.is_active ? "admin.confirmDeactivateTitle" : "admin.confirmReactivateTitle")}
        message={t(company.is_active ? "admin.confirmDeactivateMessage" : "admin.confirmReactivateMessage")}
        confirmLabel={t(company.is_active ? "admin.deactivate" : "admin.reactivate")}
        confirmVariant={company.is_active ? "danger" : "primary"}
        onConfirm={handleToggleActive}
        onCancel={() => setConfirmToggleOpen(false)}
      />

      <ResetCredentialsModal
        companyId={id}
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        onSuccess={load}
      />
    </>
  );
}

function ResetCredentialsModal({
  companyId,
  open,
  onClose,
  onSuccess,
}: {
  companyId: string;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const canSubmit = isValidMauritanianPhone(phone) && isValidLoginCode(code);

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await adminFetch(`/api/admin/companies/${companyId}/reset-credentials`, {
        method: "POST",
        body: JSON.stringify({ phone, code }),
      });
      setSuccess(true);
      onSuccess();
    } catch (err) {
      setError(
        err instanceof AdminFetchError && err.status === 409
          ? t("admin.duplicatePhoneError")
          : t("admin.createError"),
      );
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    setPhone("");
    setCode("");
    setError(null);
    setSuccess(false);
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} title={t("admin.resetCredentialsTitle")}>
      <div className="flex flex-col gap-4">
        <PhoneInput id="reset-phone" label={t("admin.ownerPhone")} value={phone} onChange={setPhone} placeholder="XXXXXXXX" />
        <CodeInput id="reset-code" label={t("auth.code")} value={code} onChange={setCode} />
        {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
        {success && (
          <p className="rounded-lg bg-success-soft px-3 py-2 text-sm text-success">
            {t("admin.resetCredentialsSuccess")}
          </p>
        )}
        <Button onClick={handleSubmit} disabled={submitting || !canSubmit}>
          {t("admin.resetCredentialsButton")}
        </Button>
      </div>
    </Modal>
  );
}
