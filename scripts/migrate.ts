// Applique dans l'ordre les fichiers .sql de db/migrations/ non encore
// appliqués (suivi via la table schema_migrations). Remplace l'exécution
// manuelle dans le SQL Editor de Supabase, décrite précédemment dans
// docs/GETTING_STARTED.md.
//
// Usage : npm run migrate

import { Client } from "pg";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Package en ESM ("type": "module") : pas de __dirname global, on le
// reconstruit depuis import.meta.url.
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL doit être défini dans .env.local");
  }

  const migrationsDir = path.join(__dirname, "..", "db", "migrations");
  const files = readdirSync(migrationsDir)
    .filter((name) => name.endsWith(".sql"))
    .sort();

  const client = new Client({ connectionString });
  await client.connect();

  try {
    await client.query(
      `create table if not exists schema_migrations (id text primary key, applied_at timestamptz not null default now())`,
    );
    const { rows } = await client.query<{ id: string }>(`select id from schema_migrations`);
    const applied = new Set(rows.map((row) => row.id));

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`⏭  ${file} (déjà appliquée)`);
        continue;
      }
      console.log(`▶  ${file}`);
      const sql = readFileSync(path.join(migrationsDir, file), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(`insert into schema_migrations (id) values ($1)`, [file]);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
    console.log("\n✅ Migrations à jour.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("\n❌ Échec des migrations :", error.message ?? error);
  process.exit(1);
});
