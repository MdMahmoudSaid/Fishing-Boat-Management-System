"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/supabase/AuthProvider";
import { signIn } from "@/lib/supabase/auth";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Logo } from "@/components/ui/Logo";

export default function LoginPage() {
  const { session, loading } = useSession();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && session) {
      router.replace("/");
    }
  }, [loading, session, router]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email, password);
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
            <Input
              id="email"
              type="email"
              label={t("auth.email")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              dir="ltr"
            />
            <Input
              id="password"
              type="password"
              label={t("auth.password")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
            {error && (
              <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
                {error}
              </p>
            )}
            <Button type="submit" disabled={submitting} className="mt-1 w-full">
              {submitting ? t("auth.loggingIn") : t("auth.loginButton")}
            </Button>
          </form>
        </Card>
      </div>
    </main>
  );
}
