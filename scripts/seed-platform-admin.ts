// Crée le tout premier compte platform_admin (aucune company associée).
// Nécessaire une seule fois par déploiement : il n'y a pas encore d'UI pour
// créer un platform_admin (problème de l'œuf et la poule — c'est justement
// ce compte qui donne accès à /admin). Les admins suivants, s'il y en a,
// peuvent être créés à la main de la même façon.
//
// Usage :
//   npm run seed-admin -- --name "Nom" --phone "44556677" --code "1234"

import { Client } from "pg";
import { randomUUID } from "node:crypto";
import { hashLoginCode } from "../lib/auth/passwords";
import { isValidLoginCode, isValidMauritanianPhone } from "../lib/auth/phoneAuth";

function requiredArg(name: string): string {
  const index = process.argv.indexOf(`--${name}`);
  const value = index !== -1 ? process.argv[index + 1] : undefined;
  if (!value) {
    throw new Error(`Argument manquant : --${name}`);
  }
  return value;
}

async function main() {
  const name = requiredArg("name");
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
    const userId = randomUUID();
    const codeHash = await hashLoginCode(code);

    console.log("Création du compte platform_admin...");
    await client.query(
      `INSERT INTO users (id, company_id, name, phone, code_hash, role) VALUES ($1, NULL, $2, $3, $4, 'platform_admin')`,
      [userId, name, phone, codeHash],
    );

    console.log("\n✅ Terminé. Connecte-toi sur /admin avec :");
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
