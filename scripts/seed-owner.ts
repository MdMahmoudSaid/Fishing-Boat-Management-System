// Crée une company + son compte owner. Historiquement le seul moyen de
// provisionner une company (§6 du PROJECT_PLAN) ; depuis l'ajout du panneau
// admin SaaS (/admin/companies/new), ce script reste un outil de secours
// (accès direct DB, utile en ops ou en local sans passer par l'UI). La
// logique d'insertion vit désormais dans lib/admin/createCompany.ts, partagée
// avec la route POST /api/admin/companies.
//
// Usage :
//   npm run seed -- --company "Nom de la société" --name "Nom du propriétaire" --phone "44556677" --code "1234"

import { Client } from "pg";
import { createCompany } from "../lib/admin/createCompany";
import { DuplicatePhoneError, ValidationError } from "../lib/admin/errors";

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

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL doit être défini dans .env.local");
  }

  const client = new Client({ connectionString });
  await client.connect();

  try {
    console.log("Création de la company et du compte owner...");
    await createCompany(client, { companyName, ownerName, phone, code });

    console.log("\n✅ Terminé. Connecte-toi dans l'app avec :");
    console.log(`   Téléphone : +222 ${phone}`);
    console.log(`   Code : celui fourni à --code`);
  } catch (error) {
    if (error instanceof ValidationError || error instanceof DuplicatePhoneError) {
      throw new Error(error.message);
    }
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("\n❌ Échec du seed :", error.message ?? error);
  process.exit(1);
});
