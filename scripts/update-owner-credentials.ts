// Met à jour le numéro de téléphone + code de connexion du compte owner
// d'UNE company (identifiée par --company), sans accès direct à la base
// autrement que via ce script.
//
// Avec plusieurs companies (SaaS), il ne peut plus y avoir de notion
// d'"unique owner de toute la base" — voir POST
// /api/admin/companies/[id]/reset-credentials pour l'équivalent en panneau
// admin, qui est désormais le chemin principal. Ce script reste un outil de
// secours en ops (accès direct DB, utile sans passer par l'UI).
//
// Usage :
//   npm run update-credentials -- --company "<uuid>" --phone "44556677" --code "1234"

import { Client } from "pg";
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
  const companyId = requiredArg("company");
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
    console.log("Recherche du compte owner de cette company...");
    const { rows: owners } = await client.query<{ id: string }>(
      `SELECT id FROM users WHERE company_id = $1 AND role = 'owner'`,
      [companyId],
    );
    if (owners.length === 0) {
      throw new Error("Aucun compte owner trouvé pour cette company.");
    }
    const owner = owners[0]!;

    console.log("Mise à jour du téléphone/code...");
    const codeHash = await hashLoginCode(code);
    await client.query(`UPDATE users SET phone = $1, code_hash = $2 WHERE id = $3`, [
      phone,
      codeHash,
      owner.id,
    ]);
    // Voir POST /api/admin/companies/[id]/reset-credentials : de nouveaux
    // identifiants doivent invalider les anciennes sessions.
    await client.query(`DELETE FROM refresh_tokens WHERE user_id = $1`, [owner.id]);

    console.log("\n✅ Terminé. Connecte-toi dans l'app avec :");
    console.log(`   Téléphone : +222 ${phone}`);
    console.log(`   Code : celui fourni à --code`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("\n❌ Échec de la mise à jour :", error.message ?? error);
  process.exit(1);
});
