// Crée le tout premier compte owner + sa company + ses réglages par défaut.
// Il n'y a volontairement aucun écran d'inscription dans l'app (§6 du
// PROJECT_PLAN) : ce script, exécuté une seule fois avec la clé
// service_role, joue ce rôle.
//
// Connexion par numéro de téléphone mauritanien (+222 fixe) + code à 4
// chiffres — voir lib/auth/phoneAuth.ts pour la dérivation du mot de passe
// réellement envoyé à Supabase Auth (qui exige ≥ 6 caractères).
//
// Usage :
//   npm run seed -- --company "Nom de la société" --name "Nom du propriétaire" --phone "44556677" --code "1234"

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import {
  deriveLoginPassword,
  isValidLoginCode,
  isValidMauritanianPhone,
  toSyntheticEmail,
} from "../lib/auth/phoneAuth";

const DEFAULT_EXPENSE_CATEGORIES = [
  "وقود", // Carburant
  "طعام", // Nourriture
  "ماء", // Eau
  "ثلج", // Glace
  "معدات الصيد", // Équipement de pêche
  "إصلاحات", // Réparations
  "رسوم الميناء", // Frais de port
  "سلفة الطاقم", // Avance équipage
  "أخرى", // Autre
];

function requiredArg(name: string): string {
  const index = process.argv.indexOf(`--${name}`);
  const value = index !== -1 ? process.argv[index + 1] : undefined;
  if (!value) {
    throw new Error(`Argument manquant : --${name}`);
  }
  return value;
}

async function main() {
  const companyName = requiredArg("company");
  const ownerName = requiredArg("name");
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

  // Fournisseur "Phone" natif de Supabase Auth désactivé sur ce projet
  // (nécessiterait un fournisseur SMS) — email synthétique dérivé du
  // téléphone à la place, jamais affiché à l'utilisateur (voir
  // lib/auth/phoneAuth.ts).
  const syntheticEmail = toSyntheticEmail(phone);

  console.log("Création du compte de connexion (Supabase Auth)...");
  const { data: userData, error: userError } = await supabase.auth.admin.createUser({
    email: syntheticEmail,
    password: deriveLoginPassword(phone, code),
    email_confirm: true,
  });
  if (userError) throw userError;
  const authUserId = userData.user.id;

  const companyId = randomUUID();

  console.log("Création de la company...");
  const { error: companyError } = await supabase
    .from("companies")
    .insert({ id: companyId, name: companyName, currency: "MRU" });
  if (companyError) throw companyError;

  console.log("Création de la ligne public.users...");
  const { error: publicUserError } = await supabase.from("users").insert({
    id: authUserId,
    company_id: companyId,
    name: ownerName,
    email: syntheticEmail,
    role: "owner",
  });
  if (publicUserError) throw publicUserError;

  console.log("Création des réglages par défaut...");
  const { error: settingsError } = await supabase.from("settings").insert({
    id: randomUUID(),
    company_id: companyId,
    default_crew_payment_method: "percentage_after_expenses",
    currency: "MRU",
    language: "ar",
  });
  if (settingsError) throw settingsError;

  console.log("Création des 8 catégories de dépenses par défaut...");
  const { error: categoriesError } = await supabase.from("expense_categories").insert(
    DEFAULT_EXPENSE_CATEGORIES.map((name) => ({
      id: randomUUID(),
      company_id: companyId,
      name,
      is_default: true,
    })),
  );
  if (categoriesError) throw categoriesError;

  console.log("\n✅ Terminé. Connecte-toi dans l'app avec :");
  console.log(`   Téléphone : +222 ${phone}`);
  console.log(`   Code : celui fourni à --code`);
}

main().catch((error) => {
  console.error("\n❌ Échec du seed :", error.message ?? error);
  process.exit(1);
});
