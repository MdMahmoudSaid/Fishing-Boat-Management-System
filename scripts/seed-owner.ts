// Crée le tout premier compte owner + sa company + ses réglages par
// défaut. Il n'y a volontairement aucun écran d'inscription dans l'app
// (§6 du PROJECT_PLAN) : ce script, exécuté avec la connexion Postgres
// admin (DATABASE_URL), joue ce rôle.
//
// Usage :
//   npm run seed -- --company "Nom de la société" --name "Nom du propriétaire" --phone "44556677" --code "1234"

import { Client } from "pg";
import { randomUUID } from "node:crypto";
import { hashLoginCode } from "../lib/auth/passwords";
import { isValidLoginCode, isValidMauritanianPhone } from "../lib/auth/phoneAuth";

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

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL doit être défini dans .env.local");
  }

  const client = new Client({ connectionString });
  await client.connect();

  try {
    const companyId = randomUUID();
    const userId = randomUUID();
    const codeHash = await hashLoginCode(code);

    console.log("Création de la company...");
    await client.query(`INSERT INTO companies (id, name, currency) VALUES ($1, $2, 'MRU')`, [
      companyId,
      companyName,
    ]);

    console.log("Création du compte owner...");
    await client.query(
      `INSERT INTO users (id, company_id, name, phone, code_hash, role) VALUES ($1, $2, $3, $4, $5, 'owner')`,
      [userId, companyId, ownerName, phone, codeHash],
    );

    console.log("Création des réglages par défaut...");
    await client.query(
      `INSERT INTO settings (id, company_id, default_crew_payment_method, currency, language)
       VALUES ($1, $2, 'percentage_after_expenses', 'MRU', 'ar')`,
      [randomUUID(), companyId],
    );

    console.log("Création des 9 catégories de dépenses par défaut...");
    for (const name of DEFAULT_EXPENSE_CATEGORIES) {
      await client.query(
        `INSERT INTO expense_categories (id, company_id, name, is_default) VALUES ($1, $2, $3, true)`,
        [randomUUID(), companyId, name],
      );
    }

    console.log("\n✅ Terminé. Connecte-toi dans l'app avec :");
    console.log(`   Téléphone : +222 ${phone}`);
    console.log(`   Code : celui fourni à --code`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("\n❌ Échec du seed :", error.message ?? error);
  process.exit(1);
});
