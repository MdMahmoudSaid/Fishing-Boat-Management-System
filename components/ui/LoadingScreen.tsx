"use client";

import { useEffect, useState } from "react";
import { t } from "@/lib/i18n";
import { Button } from "./Button";

interface LoadingScreenProps {
  // Si la requête PowerSync sous-jacente a échoué, le composant appelant le
  // sait généralement seulement via `error` (souvent ignoré jusqu'ici — voir
  // trips/[id]/page.tsx et boats/[id]/page.tsx qui ne déstructuraient que
  // `data`). Sans ça, un échec de requête est indiscernable d'un chargement
  // normal : la page reste bloquée sur "جار التحميل..." indéfiniment, sans
  // aucun signal, jusqu'à ce qu'un F5 complet réinitialise le client
  // PowerSync. On affiche donc le recours immédiatement si une erreur est
  // connue, au lieu d'attendre le délai.
  error?: unknown;
}

// Écran de chargement générique (session, ou ligne d'une page détail pas
// encore synchronisée localement). Bug remonté en test live : parfois un
// chargement reste bloqué indéfiniment après une navigation, sans qu'un
// second clic ne suffise à le débloquer — seul un F5 complet fonctionnait.
// En l'absence d'erreur explicite, on propose un rechargement en un clic
// après quelques secondes plutôt que de laisser l'utilisateur deviner qu'il
// doit le faire lui-même depuis le navigateur.
export function LoadingScreen({ error }: LoadingScreenProps = {}) {
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    if (error) return; // déjà en échec, pas besoin d'attendre le délai
    const timer = setTimeout(() => setStuck(true), 4000);
    return () => clearTimeout(timer);
  }, [error]);

  const showRecourse = stuck || !!error;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-sand p-6 text-center dark:bg-ink">
      <p className="text-sm text-ink-faint">{t("common.loading")}</p>
      {showRecourse && (
        <>
          <p className="text-xs text-ink-faint">
            {error
              ? (error instanceof Error ? error.message : String(error))
              : t("common.stillLoading")}
          </p>
          <Button variant="secondary" onClick={() => window.location.reload()}>
            {t("common.reloadPage")}
          </Button>
        </>
      )}
    </main>
  );
}
