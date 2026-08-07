// Met à jour le numéro de téléphone + code de connexion du compte owner
// existant (créé auparavant via scripts/seed-owner.ts), sans repasser par
// le dashboard Supabase. Utile pour la migration email/mot de passe ->
// téléphone/code, ou pour changer le code plus tard.
//
// Usage :
//   npm run update-credentials -- --phone "44556677" --code "1234"

import { createClient } from "@supabase/supabase-js";
import {
  deriveLoginPassword,
  isValidLoginCode,
  isValidMauritanianPhone,
  toSyntheticEmail,
} from "../lib/auth/phoneAuth";

function requiredArg(name: string): string {
  const index = process.argv.indexOf(`--${name}`);
  const value = index !== -1 ? process.argv[index + 1] : undefined;
  if (!value) {
    throw new Error(`Argument manquant : --${name}`);
  }
  return value;
}

async function main() {
  const phone = requiredArg("phone");
  const code = requiredArg("code");

  if (!isValidMauritanianPhone(phone)) {
    throw new Error(
      "--phone doit être un numéro mauritanien à 8 chiffres commençant par 2, 3 ou 4",
    );
  }
  if (!isValidLoginCode(code)) {
    throw new Error("--code doit être composé d'exactement 4 chiffres");
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être définis dans .env.local",
    );
  }

  const supabase = createClient(url, serviceRoleKey);

  // Single admin (V1) : une seule ligne dans public.users.
  console.log("Recherche du compte owner existant...");
  const { data: owners, error: ownersError } = await supabase
    .from("users")
    .select("id, email")
    .eq("role", "owner");
  if (ownersError) throw ownersError;
  if (!owners || owners.length === 0) {
    throw new Error("Aucun compte owner trouvé — utilise scripts/seed-owner.ts d'abord.");
  }
  if (owners.length > 1) {
    throw new Error(
      `${owners.length} comptes owner trouvés — ce script suppose un seul admin (V1), mise à jour annulée par sécurité.`,
    );
  }
  const owner = owners[0]!;

  // Fournisseur "Phone" natif de Supabase Auth désactivé sur ce projet
  // (testé en live : erreur phone_provider_disabled) — email synthétique
  // dérivé du téléphone à la place, voir lib/auth/phoneAuth.ts.
  const syntheticEmail = toSyntheticEmail(phone);

  console.log("Mise à jour du compte de connexion (Supabase Auth)...");
  const { error: updateError } = await supabase.auth.admin.updateUserById(owner.id, {
    email: syntheticEmail,
    password: deriveLoginPassword(phone, code),
    email_confirm: true,
  });
  if (updateError) throw updateError;

  console.log("Mise à jour de public.users.email...");
  const { error: publicUserError } = await supabase
    .from("users")
    .update({ email: syntheticEmail })
    .eq("id", owner.id);
  if (publicUserError) throw publicUserError;

  console.log("\n✅ Terminé. Connecte-toi dans l'app avec :");
  console.log(`   Téléphone : +222 ${phone}`);
  console.log(`   Code : celui fourni à --code`);
}

main().catch((error) => {
  console.error("\n❌ Échec de la mise à jour :", error.message ?? error);
  process.exit(1);
});
