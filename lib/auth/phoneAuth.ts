// Authentification par numéro de téléphone mauritanien + code à 4 chiffres.
// Fonctions pures, sans dépendance React/Next — importées à la fois par le
// client (lib/auth/authClient.ts) et par les scripts Node (scripts/*.ts).

export const COUNTRY_CODE = "+222";

// Chinguitel (2), Mattel (3), Mauritel (4) — seuls opérateurs mauritaniens.
// Numéro local : 8 chiffres au total (indicatif +222 exclu).
const PHONE_PATTERN = /^[234]\d{7}$/;
const CODE_PATTERN = /^\d{4}$/;

export function isValidMauritanianPhone(digits: string): boolean {
  return PHONE_PATTERN.test(digits);
}

export function isValidLoginCode(code: string): boolean {
  return CODE_PATTERN.test(code);
}
