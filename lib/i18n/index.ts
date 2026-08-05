import ar from "./ar.json";

const dictionaries = { ar } as const;

export type Locale = keyof typeof dictionaries;

type Dictionary = typeof ar;

type DotPaths<T, Prefix extends string = ""> = {
  [K in keyof T & string]: T[K] extends string
    ? `${Prefix}${K}`
    : DotPaths<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

export type TranslationKey = DotPaths<Dictionary>;

const currentLocale: Locale = "ar";

export function t(key: TranslationKey): string {
  const parts = key.split(".");
  let value: any = dictionaries[currentLocale];
  for (const part of parts) {
    value = value?.[part];
  }
  return typeof value === "string" ? value : key;
}
