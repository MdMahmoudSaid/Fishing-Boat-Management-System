// Met à jour le numéro de téléphone + code de connexion du compte owner
// existant, sans accès direct à la base autrement que via ce script.
//
// Usage :
//   npm run update-credentials -- --phone "44556677" --code "1234"

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
    console.log("Recherche du compte owner existant...");
    const { rows: owners } = await client.query<{ id: string }>(
      `SELECT id FROM users WHERE role = 'owner'`,
    );
    if (owners.length === 0) {
      throw new Error("Aucun compte owner trouvé — utilise scripts/seed-owner.ts d'abord.");
    }
    if (owners.length > 1) {
      throw new Error(
        `${owners.length} comptes owner trouvés — ce script suppose un seul admin (V1), mise à jour annulée par sécurité.`,
      );
    }
    const owner = owners[0]!;

    console.log("Mise à jour du téléphone/code...");
    const codeHash = await hashLoginCode(code);
    await client.query(`UPDATE users SET phone = $1, code_hash = $2 WHERE id = $3`, [
      phone,
      codeHash,
      owner.id,
    ]);

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
