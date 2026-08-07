import { supabase } from "./client";
import { deriveLoginPassword, toSyntheticEmail } from "@/lib/auth/phoneAuth";

// `phoneDigits` : 8 chiffres locaux, sans le +222 (déjà validés côté
// formulaire, voir app/(auth)/login/page.tsx). Envoyé à Supabase via un
// email synthétique (fournisseur Phone natif désactivé sur ce projet) et un
// mot de passe dérivé du code à 4 chiffres — voir lib/auth/phoneAuth.ts.
export async function signIn(phoneDigits: string, code: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({
    email: toSyntheticEmail(phoneDigits),
    password: deriveLoginPassword(phoneDigits, code),
  });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
