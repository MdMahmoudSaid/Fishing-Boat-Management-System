// Authentification par numéro de téléphone mauritanien + code à 4 chiffres.
// Fonctions pures, sans dépendance React/Next — importées à la fois par le
// client (lib/supabase/auth.ts) et par les scripts Node (scripts/*.ts), pour
// que la dérivation du mot de passe reste identique des deux côtés.

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

// Le fournisseur "Phone" natif de Supabase Auth est désactivé sur ce projet
// (nécessiterait un fournisseur SMS type Twilio, même pour du login par mot
// de passe sans OTP — vérifié en test live : erreur "phone_provider_disabled").
// On reste donc sur le fournisseur Email (déjà actif) avec un email
// synthétique dérivé du numéro, jamais affiché à l'utilisateur — seul le
// couple téléphone/code est visible côté UI (voir app/(auth)/login/page.tsx).
export function toSyntheticEmail(phoneDigits: string): string {
  return `${phoneDigits}@fbms.local`;
}

// Supabase Auth exige un mot de passe d'au moins 6 caractères par défaut ;
// le code saisi par l'utilisateur ne fait que 4 chiffres. On dérive donc un
// mot de passe plus long, de façon déterministe à partir du numéro et du
// code — transparent pour l'utilisateur, qui ne voit/tape jamais que le
// code à 4 chiffres. Doit rester identique ici et dans
// scripts/update-owner-credentials.ts (même fonction, un seul endroit).
export function deriveLoginPassword(phoneDigits: string, code: string): string {
  return `fbms-${phoneDigits}-${code}`;
}
