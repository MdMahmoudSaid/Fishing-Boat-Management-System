"use client";

import { useSyncExternalStore } from "react";
import { getLocale, subscribeLocale, DEFAULT_LOCALE, type Locale } from "./index";

// Pattern React officiel pour un store externe mutable (currentLocale vit en
// dehors de React, voir lib/i18n/index.ts). getServerSnapshot renvoie
// toujours DEFAULT_LOCALE ("ar") pour matcher le rendu serveur statique de
// app/layout.tsx.
export function useLocale(): Locale {
  return useSyncExternalStore(subscribeLocale, getLocale, () => DEFAULT_LOCALE);
}
