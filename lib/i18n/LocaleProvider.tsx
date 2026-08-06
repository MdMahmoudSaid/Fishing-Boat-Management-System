"use client";

import { Fragment, useEffect } from "react";
import { useQuery } from "@powersync/react";
import { useCompanyId } from "@/lib/auth/useCompanyId";
import { getLocale, isValidLocale, setLocale, t, type Locale } from "./index";
import { useLocale } from "./useLocale";

interface SettingsLanguageRow {
  language: string;
}

// Placé sous PowerSyncProvider/AuthProvider (app/layout.tsx) : englobe aussi
// bien /login que /(app)/* pour garder un seul point de vérité, même si le
// sélecteur de langue lui-même ne vit que dans /settings.
//
// Deux couches, toutes deux hors-ligne :
// - Couche 1 (instantanée) : lib/i18n/index.ts lit déjà localStorage à
//   l'import du module, donc t() est correct dès le tout premier rendu,
//   companyId ou pas.
// - Couche 2 (source de vérité) : ici, dès que settings.language est
//   disponible localement via PowerSync, on réconcilie avec le cache — utile
//   si la langue a été changée depuis un autre appareil et resynchronisée.
//
// Remonter `children` avec key={locale} force tous les appels `t()` déjà
// répandus dans ~40 fichiers (fonctions simples, pas des hooks) à se
// ré-exécuter avec la nouvelle langue, sans avoir à les réécrire. Le
// changement de langue étant une action isolée déclenchée depuis /settings,
// le seul état perdu possible est un champ non sauvegardé sur cette page
// elle-même — AuthProvider/PowerSyncProvider et le singleton DB ne sont pas
// remontés (ce composant est en dessous d'eux).
export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const locale = useLocale();
  const { companyId } = useCompanyId();
  const { data } = useQuery<SettingsLanguageRow>(
    "SELECT language FROM settings WHERE company_id = ?",
    [companyId ?? ""],
  );
  const dbLocale = data?.[0]?.language;

  useEffect(() => {
    if (dbLocale && isValidLocale(dbLocale) && dbLocale !== getLocale()) {
      setLocale(dbLocale as Locale);
    }
  }, [dbLocale]);

  // Confort : reflète la langue active dans l'onglet du navigateur. Les
  // métadonnées serveur (app/layout.tsx) restent statiques en arabe (pas de
  // source de vérité côté serveur pour la langue).
  useEffect(() => {
    document.title = t("app.name");
  }, [locale]);

  return <Fragment key={locale}>{children}</Fragment>;
}
