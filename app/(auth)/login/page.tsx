"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/supabase/AuthProvider";
import { signIn } from "@/lib/supabase/auth";
import { isValidMauritanianPhone, isValidLoginCode } from "@/lib/auth/phoneAuth";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/Button";
import { PhoneInput } from "@/components/ui/PhoneInput";
import { CodeInput } from "@/components/ui/CodeInput";
import { Card } from "@/components/ui/Card";
import { Logo } from "@/components/ui/Logo";

export default function LoginPage() {
  const { session, loading } = useSession();
  const router = useRouter();

  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && session) {
      router.replace("/");
    }
  }, [loading, session, router]);

  // Erreur affichée seulement une fois le champ rempli à sa longueur
  // attendue (8 chiffres / 4 chiffres) — pas pendant la saisie en cours.
  const phoneError =
    phone.length === 8 && !isValidMauritanianPhone(phone)
      ? t("auth.phoneInvalid")
      : undefined;
  const canSubmit = isValidMauritanianPhone(phone) && isValidLoginCode(code);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);
    try {
      await signIn(phone, code);
      router.replace("/");
    } catch {
      setError(t("auth.loginError"));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || session) return null;

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-sand p-6 dark:bg-ink">
      {/* Horizon décoratif : évoque la mer, discret, purement atmosphérique. */}
      <svg
        className="pointer-events-none absolute inset-x-0 bottom-0 h-40 w-full text-sea-soft dark:text-white/5"
        viewBox="0 0 400 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M0 40 C 60 10, 120 10, 200 40 S 340 70, 400 40 V100 H0 Z"
          fill="currentColor"
        />
      </svg>

      <div className="relative z-10 flex w-full max-w-sm flex-col items-center">
        <Logo size={64} className="mb-3" />
        <p className="font-display mb-8 text-center text-xl font-semibold text-ink dark:text-sand">
          {t("app.name")}
        </p>

        <Card className="w-full p-6">
          <h1 className="mb-5 text-center text-base font-semibold text-ink-soft dark:text-sand/80">
            {t("auth.loginTitle")}
          </h1>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <PhoneInput
              id="phone"
              label={t("auth.phone")}
              value={phone}
              onChange={setPhone}
              error={phoneError}
              required
              placeholder="XXXXXXXX"
            />
            <CodeInput
              id="code"
              label={t("auth.code")}
              value={code}
              onChange={setCode}
              required
              autoComplete="off"
            />
            {error && (
              <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
                {error}
              </p>
            )}
            <Button
              type="submit"
              disabled={submitting || !canSubmit}
              className="mt-1 w-full"
            >
              {submitting ? t("auth.loggingIn") : t("auth.loginButton")}
            </Button>
          </form>
        </Card>
      </div>
    </main>
  );
}
