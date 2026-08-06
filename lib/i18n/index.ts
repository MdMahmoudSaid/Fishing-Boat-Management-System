import ar from "./ar.json";
import fr from "./fr.json";

const dictionaries = { ar, fr } as const;

export type Locale = keyof typeof dictionaries;

export const LOCALES: readonly Locale[] = ["ar", "fr"];
export const DEFAULT_LOCALE: Locale = "ar";
export const LOCALE_DIRECTION: Record<Locale, "rtl" | "ltr"> = {
  ar: "rtl",
  fr: "ltr",
};

// Doit rester synchronisé avec le littéral dupliqué dans le script
// beforeInteractive de app/layout.tsx : un script inline (exécuté avant
// l'hydratation, avant que ce module ne soit chargé) ne peut pas importer
// cette constante.
const STORAGE_KEY = "fbms:locale";

type Dictionary = typeof ar;

type DotPaths<T, Prefix extends string = ""> = {
  [K in keyof T & string]: T[K] extends string
    ? `${Prefix}${K}`
    : DotPaths<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

export type TranslationKey = DotPaths<Dictionary>;

export function isValidLocale(value: unknown): value is Locale {
  return value === "ar" || value === "fr";
}

// État module-level intentionnellement en dehors de React : `t()` est
// appelée comme simple fonction synchrone depuis ~40 fichiers (pages,
// formulaires, et même des modules purs de lib/calculations sans "use
// client"). Le composant client `LocaleProvider` (lib/i18n/LocaleProvider.tsx)
// s'abonne à ce store via useSyncExternalStore et remonte son sous-arbre
// quand la langue change, ce qui permet à tous ces appels existants de
// refléter la nouvelle langue sans être réécrits en hooks.
let currentLocale: Locale = DEFAULT_LOCALE;

// Lecture synchrone du cache local dès l'import du module : couvre le tout
// premier rendu client (y compris /login, avant toute session/PowerSync),
// sans dépendre du réseau — cohérent avec l'exigence offline-first.
if (typeof window !== "undefined") {
  const cached = window.localStorage.getItem(STORAGE_KEY);
  if (isValidLocale(cached)) currentLocale = cached;
}

const listeners = new Set<() => void>();

export function getLocale(): Locale {
  return currentLocale;
}

export function setLocale(locale: Locale): void {
  if (locale === currentLocale) return;
  currentLocale = locale;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, locale);
    document.documentElement.lang = locale;
    document.documentElement.dir = LOCALE_DIRECTION[locale];
  }
  listeners.forEach((listener) => listener());
}

export function subscribeLocale(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function t(
  key: TranslationKey,
  params?: Record<string, string | number>,
): string {
  const parts = key.split(".");
  let value: any = dictionaries[currentLocale];
  for (const part of parts) {
    value = value?.[part];
  }
  if (typeof value !== "string") return key;
  if (!params) return value;
  return value.replace(/\{(\w+)\}/g, (match, name) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match,
  );
}
