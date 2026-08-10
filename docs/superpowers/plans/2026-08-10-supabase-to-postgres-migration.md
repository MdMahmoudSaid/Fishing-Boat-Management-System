# Migration Supabase → PostgreSQL self-hébergé Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer Supabase (Auth, Storage, API PostgREST) par une stack 100% auto-hébergée (Postgres + MinIO + auth JWT maison) sur le VPS du client, sans changer le comportement observable de l'app ni perdre PowerSync.

**Architecture:** PowerSync reste inchangé (toujours PowerSync Cloud), mais sa source Postgres et son mécanisme d'auth JWT changent. `BackendConnector.uploadData()` appelle une nouvelle route `/api/sync/write` (au lieu de l'API PostgREST de Supabase) qui écrit en SQL paramétré via `pg`, dans une transaction où RLS reste active (variables de session `app.company_id`/`app.user_id`). L'auth devient un JWT HS256 maison (téléphone + code à 4 chiffres inchangés côté UI). Les photos passent par MinIO via deux routes proxy (upload/download), jamais exposé directement au navigateur.

**Tech Stack:** Next.js App Router (routes API Node runtime), `pg` (Postgres client), `bcryptjs` (hash du code de connexion), `jose` (JWT HS256), `minio` (client S3-compatible), Docker Compose (Postgres + MinIO, local et VPS identiques).

## Global Constraints

- Comportement utilisateur final inchangé : écran de connexion téléphone (8 chiffres, +222) + code à 4 chiffres — voir [[auth-4digit-code-accepted-risk]].
- Aucune migration de données réelles nécessaire (confirmé : données de test uniquement).
- PowerSync reste sur PowerSync Cloud — seule sa configuration change (source DB, client auth).
- RLS Postgres reste active en défense en profondeur (le schéma dénormalise déjà `company_id` sur chaque table dans ce but).
- Tous les codes d'erreur Postgres actuellement gérés par `BackendConnector` (`42501`, `23505`, `23503`, `23514`, `23502`, `22P02`, `42703`, `42P01`) doivent continuer à produire le même comportement non-retryable après la migration.
- Toutes les nouvelles routes API Next.js utilisent `export const runtime = "nodejs";` (elles dépendent de `pg`/`bcryptjs`/`minio`/`crypto`, incompatibles avec l'edge runtime) et `export const dynamic = "force-dynamic";` (jamais de cache — elles gèrent des tokens/données par utilisateur).
- Commentaires de code en français, dans le style existant du projet (expliquer le "pourquoi", pas juste le "quoi").
- `docs/PROJECT_PHASES.md` est un journal historique des phases déjà construites — ne pas le réécrire, il documente ce qui a été fait avec Supabase à l'époque.

---

## Task 1: Infrastructure Docker + dépendances npm

**Files:**
- Create: `docker-compose.yml`
- Modify: `.env.example`
- Modify: `package.json`

**Interfaces:**
- Produces: services `postgres` (port 5432, `wal_level=logical`) et `minio` (port 9000 API / 9001 console) disponibles via `docker compose up -d`. Nouvelles dépendances (`pg`, `bcryptjs`, `jose`, `minio`) disponibles pour les tâches suivantes.

- [ ] **Step 1: Créer `docker-compose.yml`**

```yaml
# Stack self-hébergée qui remplace Supabase (Postgres + Storage). Utilisée
# en local (npm run dev) et sur le VPS de production — seules les valeurs de
# .env diffèrent (mots de passe, volumes). PowerSync (Cloud) et l'app
# Next.js ne sont pas dans cette stack.
services:
  postgres:
    image: postgres:16
    restart: unless-stopped
    environment:
      POSTGRES_DB: fbms
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-postgres}
    # wal_level=logical : requis par PowerSync pour la réplication logique
    # (rôle powersync_role, voir docs/GETTING_STARTED.md).
    command: ["postgres", "-c", "wal_level=logical"]
    ports:
      - "5432:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data

  minio:
    image: minio/minio:latest
    restart: unless-stopped
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER:-minioadmin}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD:-minioadmin}
    command: server /data --console-address ":9001"
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - minio-data:/data

volumes:
  postgres-data:
  minio-data:
```

- [ ] **Step 2: Lancer la stack et vérifier qu'elle démarre**

Run: `docker compose up -d && docker compose ps`
Expected: les deux services `postgres` et `minio` en état `running`/`healthy`.

- [ ] **Step 3: Remplacer `.env.example`**

```
# Postgres — connexion admin (migrations, scripts seed, routes /api/auth/*
# qui doivent chercher un utilisateur par téléphone avant qu'une session
# n'existe, donc sans RLS).
DATABASE_URL=postgres://postgres:postgres@localhost:5432/fbms

# Postgres — connexion applicative restreinte (rôle `app`, RLS active),
# utilisée uniquement par /api/sync/write. Voir db/app_role_setup.sql,
# créé localement à partir du modèle dans docs/GETTING_STARTED.md (jamais
# committé — contient un mot de passe).
APP_DATABASE_URL=postgres://app:CHANGE_ME@localhost:5432/fbms

# Secret partagé pour signer/vérifier les JWT (émis par /api/auth/login,
# vérifiés par nos routes API ET par la config "Client Auth" de l'instance
# PowerSync — voir docs/GETTING_STARTED.md).
JWT_SECRET=

# MinIO — remplace Supabase Storage pour les photos de dépenses.
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=expense-photos
MINIO_USE_SSL=false

NEXT_PUBLIC_POWERSYNC_URL=
```

- [ ] **Step 4: Ajouter les nouvelles dépendances dans `package.json`**

Dans `dependencies`, ajouter (ordre alphabétique avec l'existant) :
```json
    "bcryptjs": "latest",
    "jose": "latest",
    "minio": "latest",
    "pg": "latest",
```
Dans `devDependencies`, ajouter :
```json
    "@types/bcryptjs": "latest",
    "@types/pg": "latest",
```

Garder `@supabase/supabase-js` pour l'instant — retiré uniquement à la Task 23, une fois tous ses usages remplacés.

- [ ] **Step 5: Installer**

Run: `npm install`
Expected: `pg`, `bcryptjs`, `jose`, `minio` apparaissent dans `node_modules`, aucune erreur.

- [ ] **Step 6: Commit**

```bash
git add docker-compose.yml .env.example package.json package-lock.json
git commit -m "infra: ajoute Docker Compose (Postgres+MinIO) et les dépendances de la migration Supabase -> Postgres

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: Migrations SQL réécrites (schéma, RLS, rôle app, refresh tokens)

**Files:**
- Create: `db/migrations/` (déplacé depuis `supabase/migrations/`)
- Modify: `db/migrations/20260804000000_init_schema.sql` (ex `supabase/migrations/...`)
- Modify: `db/migrations/20260804000001_rls_policies.sql` (ex `supabase/migrations/...`)
- Delete: `db/migrations/20260805000000_expense_photos_storage.sql` (bucket Supabase Storage, obsolète)
- Keep as-is (déplacé) : `db/migrations/20260805000001_sales_total_amount_plain_column.sql`
- Create: `db/migrations/20260806000000_refresh_tokens.sql`
- Move: `supabase/powersync_setup.sql` → `db/powersync_setup.sql` (fichier local non committé, contient un mot de passe)
- Modify: `.gitignore`
- Modify: `lib/powersync/AppSchema.ts:17-27` (miroir local de `public.users`)

**Interfaces:**
- Produces: schéma Postgres cible complet, appliqué par `scripts/migrate.ts` (Task 3). Table `public.users` avec colonnes `phone text unique not null`, `code_hash text not null` (remplace `email`/`password_hash`). Rôle `app` référencé par les policies RLS. Table `public.refresh_tokens(id, user_id, token_hash, expires_at, created_at)`.

- [ ] **Step 1: Déplacer le dossier de migrations**

```bash
git mv supabase/migrations db/migrations
mv supabase/powersync_setup.sql db/powersync_setup.sql 2>/dev/null || true
rmdir supabase 2>/dev/null || true
```

- [ ] **Step 2: Mettre à jour `.gitignore`**

Remplacer la ligne `supabase/powersync_setup.sql` par :
```
# Contient un mot de passe réel une fois rempli — jamais commit
db/powersync_setup.sql
db/app_role_setup.sql
```

- [ ] **Step 3: Éditer `db/migrations/20260804000000_init_schema.sql`**

Remplacer le bloc `public.users` :
```sql
  create table public.users (
    id uuid primary key,
    company_id uuid not null references public.companies (id),
    name text not null,
    phone text not null unique,
    code_hash text not null,
    role text not null default 'owner' check (role in ('owner')),
    created_at timestamptz not null default now()
  );
  create index users_company_id_idx on public.users (company_id);
```
(remplace l'ancien `id uuid primary key references auth.users (id) on delete cascade` +
`email text not null unique` + `password_hash text` — `auth.users` est une table
Supabase Auth qui n'existe plus ; `phone`/`code_hash` sont l'identité de connexion
directe, voir Task 8.)

- [ ] **Step 4: Éditer `db/migrations/20260804000001_rls_policies.sql`**

Remplacer tout le contenu par :
```sql
-- Row Level Security — isolation par company_id.
--
-- Contexte de session : les routes API authentifiées (/api/sync/write en
-- particulier, voir lib/postgres/withCompanyContext.ts) positionnent
-- `app.company_id` et `app.user_id` via `set_config(..., true)` (portée
-- transaction) au début de chaque transaction, à partir des claims du JWT
-- vérifié. Ces policies ne lisent que ce contexte de session — plus de
-- dépendance à un fournisseur d'auth externe (auth.uid() était fourni par
-- Supabase Auth).
--
-- Le rôle `app` (créé manuellement via db/app_role_setup.sql, voir
-- docs/GETTING_STARTED.md) est RLS-restreint : contrairement à
-- powersync_role (bypassrls), toute requête qu'il exécute passe par ces
-- policies.

create schema if not exists private;

create or replace function private.user_company_id()
returns uuid
language sql
security definer
set search_path = ''
stable
as $$
  select nullif(current_setting('app.company_id', true), '')::uuid
$$;

revoke execute on function private.user_company_id() from public;
grant execute on function private.user_company_id() to app;

alter table public.companies enable row level security;

create policy companies_select on public.companies
  for select to app
  using (id = (select private.user_company_id()));

create policy companies_update on public.companies
  for update to app
  using (id = (select private.user_company_id()))
  with check (id = (select private.user_company_id()));

alter table public.users enable row level security;

create policy users_select_self on public.users
  for select to app
  using (id = (nullif(current_setting('app.user_id', true), ''))::uuid);

-- Toutes les autres tables : isolation directe par company_id.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'boats', 'crew_members', 'fish_categories', 'fish_quality_levels',
    'expense_categories', 'buyers', 'trips', 'trip_crew', 'expenses',
    'catches', 'sales', 'sale_payments', 'settings'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format(
      'create policy %I on public.%I for all to app using (company_id = (select private.user_company_id())) with check (company_id = (select private.user_company_id()))',
      table_name || '_company_isolation', table_name
    );
  end loop;
end $$;
```

- [ ] **Step 5: Supprimer la migration de stockage Supabase**

```bash
git rm db/migrations/20260805000000_expense_photos_storage.sql
```
(le bucket MinIO est créé par `scripts/init-minio.ts`, Task 18 — pas par SQL.)

- [ ] **Step 6: Créer `db/migrations/20260806000000_refresh_tokens.sql`**

```sql
-- Refresh tokens (révocation server-side) — remplace la gestion de session
-- de Supabase Auth. Le token n'est jamais stocké en clair (voir
-- lib/auth/refreshTokens.ts) ; sa révocation (logout, rotation à chaque
-- refresh) se fait en supprimant la ligne.
create table public.refresh_tokens (
  id uuid primary key,
  user_id uuid not null references public.users (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index refresh_tokens_user_id_idx on public.refresh_tokens (user_id);
```

- [ ] **Step 7: Mettre à jour le miroir local `lib/powersync/AppSchema.ts`**

Remplacer le bloc `users` (lignes 17-27) :
```ts
const users = new Table(
  {
    company_id: column.text,
    name: column.text,
    phone: column.text,
    code_hash: column.text,
    role: column.text,
    created_at: column.text,
  },
  { indexes: { company: ["company_id"] } },
);
```

- [ ] **Step 8: Commit**

```bash
git add db .gitignore lib/powersync/AppSchema.ts
git rm -r --cached supabase 2>/dev/null || true
git commit -m "db: migrations Postgres self-hébergé (users par téléphone, RLS via GUC, refresh_tokens)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: Script de migration (`scripts/migrate.ts`)

**Files:**
- Create: `scripts/migrate.ts`
- Modify: `package.json` (script `migrate`)

**Interfaces:**
- Consumes: fichiers `db/migrations/*.sql` (Task 2), `DATABASE_URL` (Task 1).
- Produces: `npm run migrate` — applique les migrations non encore appliquées, idempotent (table `schema_migrations`).

- [ ] **Step 1: Créer `scripts/migrate.ts`**

```ts
// Applique dans l'ordre les fichiers .sql de db/migrations/ non encore
// appliqués (suivi via la table schema_migrations). Remplace l'exécution
// manuelle dans le SQL Editor de Supabase, décrite précédemment dans
// docs/GETTING_STARTED.md.
//
// Usage : npm run migrate

import { Client } from "pg";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

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
```

- [ ] **Step 2: Ajouter le script npm**

Dans `package.json` `scripts`, ajouter :
```json
    "migrate": "tsx --env-file=.env.local scripts/migrate.ts",
```

- [ ] **Step 3: Créer `db/app_role_setup.sql` localement (non committé) et l'exécuter**

Créer manuellement `db/app_role_setup.sql` (gitignored, Task 2 Step 2) à partir de :
```sql
create role app with login password 'CHOISIS_UN_MOT_DE_PASSE_FORT' noinherit;
grant usage on schema public to app;
grant select, insert, update, delete on all tables in schema public to app;
alter default privileges in schema public grant select, insert, update, delete on tables to app;
```

Run: `docker compose exec -T postgres psql -U postgres -d fbms < db/app_role_setup.sql`
Expected: `CREATE ROLE`, `GRANT` sans erreur. Mettre à jour `APP_DATABASE_URL` dans `.env.local` avec ce mot de passe.

- [ ] **Step 4: Vérifier manuellement que les migrations s'appliquent**

Créer `.env.local` (à partir de `.env.example`) avec `DATABASE_URL=postgres://postgres:postgres@localhost:5432/fbms` (mot de passe du docker-compose).

Run: `npm run migrate`
Expected: chaque fichier de `db/migrations/` s'affiche avec `▶`, se termine par `✅ Migrations à jour.`. Relancer la commande : tous les fichiers doivent s'afficher avec `⏭` (idempotence).

Vérifier : `docker compose exec postgres psql -U postgres -d fbms -c '\dt public.*'` liste bien les 15 tables métier + `refresh_tokens` + `schema_migrations`.

- [ ] **Step 5: Commit**

```bash
git add scripts/migrate.ts package.json package-lock.json
git commit -m "db: ajoute le script de migration scripts/migrate.ts

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: Pools Postgres serveur (`lib/postgres/pool.ts`, `lib/env.ts`)

**Files:**
- Create: `lib/env.ts`
- Create: `lib/postgres/pool.ts`

**Interfaces:**
- Produces: `requireEnv(name: string): string`. `getAdminPool(): Pool` (connexion `DATABASE_URL`, sans RLS — utilisée par les routes `/api/auth/*` et les scripts). `getAppPool(): Pool` (connexion `APP_DATABASE_URL`, rôle `app` RLS-restreint — utilisée uniquement par `/api/sync/write`).

- [ ] **Step 1: Créer `lib/env.ts`**

```ts
// Lit une variable d'environnement serveur obligatoire, erreur explicite si
// absente — évite les erreurs Postgres/JWT peu claires en cas d'oubli de
// config (voir .env.example).
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} doit être défini (voir .env.example)`);
  }
  return value;
}
```

- [ ] **Step 2: Créer `lib/postgres/pool.ts`**

```ts
// Deux connexions Postgres distinctes, par niveau de privilège :
// - adminPool (DATABASE_URL) : sans RLS, réservé aux routes qui doivent
//   chercher un utilisateur par téléphone avant qu'une session n'existe
//   (/api/auth/login, /api/auth/refresh) — joue le rôle que Supabase Auth
//   (GoTrue) jouait avec sa propre connexion privilégiée.
// - appPool (APP_DATABASE_URL, rôle `app`) : RLS active, utilisée
//   uniquement par /api/sync/write, avec le contexte de session positionné
//   par withCompanyContext() avant chaque requête.
import { Pool } from "pg";
import { requireEnv } from "@/lib/env";

let adminPool: Pool | null = null;
let appPool: Pool | null = null;

export function getAdminPool(): Pool {
  if (!adminPool) {
    adminPool = new Pool({ connectionString: requireEnv("DATABASE_URL") });
  }
  return adminPool;
}

export function getAppPool(): Pool {
  if (!appPool) {
    appPool = new Pool({ connectionString: requireEnv("APP_DATABASE_URL") });
  }
  return appPool;
}
```

- [ ] **Step 3: Vérification manuelle**

Run: `npx tsx --env-file=.env.local -e "import('./lib/postgres/pool').then(async (m) => { const r = await m.getAdminPool().query('select 1 as ok'); console.log(r.rows); process.exit(0); })"`
Expected: `[ { ok: 1 } ]`.

- [ ] **Step 4: Commit**

```bash
git add lib/env.ts lib/postgres/pool.ts
git commit -m "server: ajoute les pools Postgres admin/app (lib/postgres/pool.ts)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: Contexte de transaction RLS (`lib/postgres/withCompanyContext.ts`)

**Files:**
- Create: `lib/postgres/withCompanyContext.ts`

**Interfaces:**
- Consumes: `getAppPool()` (Task 4).
- Produces: `withCompanyContext<T>(userId: string, companyId: string, fn: (client: PoolClient) => Promise<T>): Promise<T>` — utilisé par `/api/sync/write` (Task 15).

- [ ] **Step 1: Créer `lib/postgres/withCompanyContext.ts`**

```ts
// Exécute `fn` dans une transaction où les variables de session
// app.company_id/app.user_id sont positionnées — lues par les policies RLS
// (db/migrations/20260804000001_rls_policies.sql). `set_config(..., true)`
// = portée transaction uniquement (équivalent paramétrable de SET LOCAL),
// jamais persistée sur la connexion réutilisée par le pool.
import type { PoolClient } from "pg";
import { getAppPool } from "./pool";

export async function withCompanyContext<T>(
  userId: string,
  companyId: string,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getAppPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.company_id', $1, true)", [companyId]);
    await client.query("SELECT set_config('app.user_id', $1, true)", [userId]);
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/postgres/withCompanyContext.ts
git commit -m "server: ajoute withCompanyContext (contexte RLS par transaction)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: Construction des requêtes de synchro (`lib/postgres/syncWrite.ts`) — TDD

**Files:**
- Create: `lib/postgres/postgresErrorCodes.ts`
- Create: `lib/postgres/syncWrite.ts`
- Test: `lib/postgres/syncWrite.test.ts`

**Interfaces:**
- Produces: `NON_RETRYABLE_POSTGRES_ERROR_CODES: ReadonlySet<string>` (partagé entre `/api/sync/write` et `BackendConnector`). `SyncWriteError` (classe, propriété `code: string`). `assertSyncableTable(table: string): void`. `buildSyncQuery(operation: SyncOperation): { text: string; values: unknown[] }` avec `SyncOperation = { table: string; op: "PUT" | "PATCH" | "DELETE"; id: string; data?: Record<string, unknown> }`.

- [ ] **Step 1: Créer `lib/postgres/postgresErrorCodes.ts`**

```ts
// Codes d'erreur Postgres qui ne peuvent JAMAIS réussir en réessayant —
// voir lib/powersync/BackendConnector.ts pour le détail du problème que ça
// résout (file de synchro PowerSync bloquée en FIFO). Partagé entre le
// connecteur PowerSync (client) et /api/sync/write (serveur) pour que les
// deux bouts s'accordent sur le même contrat.
export const NON_RETRYABLE_POSTGRES_ERROR_CODES = new Set([
  "42501", // insufficient_privilege — violation RLS
  "23505", // unique_violation
  "23503", // foreign_key_violation
  "23514", // check_violation
  "23502", // not_null_violation
  "22P02", // invalid_text_representation (ex : UUID malformé)
  "42703", // undefined_column
  "42P01", // undefined_table
]);
```

- [ ] **Step 2: Écrire le test qui échoue — `lib/postgres/syncWrite.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { assertSyncableTable, buildSyncQuery, SyncWriteError } from "./syncWrite";

describe("assertSyncableTable", () => {
  it("accepte une table métier connue", () => {
    expect(() => assertSyncableTable("boats")).not.toThrow();
  });

  it("rejette une table non autorisée avec le code 42P01", () => {
    expect(() => assertSyncableTable("companies")).toThrow(SyncWriteError);
    try {
      assertSyncableTable("companies");
    } catch (error) {
      expect((error as SyncWriteError).code).toBe("42P01");
    }
  });
});

describe("buildSyncQuery", () => {
  it("construit un DELETE paramétré", () => {
    const query = buildSyncQuery({ table: "boats", op: "DELETE", id: "b1" });
    expect(query.text).toBe("DELETE FROM boats WHERE id = $1");
    expect(query.values).toEqual(["b1"]);
  });

  it("construit un INSERT ... ON CONFLICT pour PUT", () => {
    const query = buildSyncQuery({
      table: "boats",
      op: "PUT",
      id: "b1",
      data: { company_id: "c1", name: "Amel" },
    });
    expect(query.text).toContain("INSERT INTO boats (company_id, name, id)");
    expect(query.text).toContain("ON CONFLICT (id) DO UPDATE SET company_id = excluded.company_id, name = excluded.name");
    expect(query.values).toEqual(["c1", "Amel", "b1"]);
  });

  it("construit un UPDATE pour PATCH", () => {
    const query = buildSyncQuery({
      table: "boats",
      op: "PATCH",
      id: "b1",
      data: { status: "maintenance" },
    });
    expect(query.text).toBe("UPDATE boats SET status = $1 WHERE id = $2");
    expect(query.values).toEqual(["maintenance", "b1"]);
  });

  it("rejette une colonne non autorisée avec le code 42703", () => {
    expect(() =>
      buildSyncQuery({ table: "boats", op: "PATCH", id: "b1", data: { not_a_real_column: 1 } }),
    ).toThrow(SyncWriteError);
    try {
      buildSyncQuery({ table: "boats", op: "PATCH", id: "b1", data: { not_a_real_column: 1 } });
    } catch (error) {
      expect((error as SyncWriteError).code).toBe("42703");
    }
  });
});
```

- [ ] **Step 3: Lancer le test, vérifier qu'il échoue**

Run: `npx vitest run lib/postgres/syncWrite.test.ts`
Expected: FAIL — `Cannot find module './syncWrite'`.

- [ ] **Step 4: Implémenter `lib/postgres/syncWrite.ts`**

```ts
// Construit les requêtes SQL paramétrées qui remplacent
// supabase.from(table).upsert()/.update()/.delete() (API PostgREST). Table
// et colonnes vérifiées contre un allowlist fixe (dérivé du schéma dans
// db/migrations/20260804000000_init_schema.sql) : les identifiants SQL ne
// sont jamais interpolés à partir d'une valeur non validée, ce qui exclut
// toute injection même si `data` vient du client (via PowerSync).
export class SyncWriteError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

const TABLE_COLUMNS: Record<string, ReadonlySet<string>> = {
  boats: new Set([
    "id", "company_id", "name", "registration_number", "captain_name",
    "notes", "status", "created_at", "updated_at", "deleted_at",
  ]),
  crew_members: new Set(["id", "company_id", "name", "phone", "notes", "created_at", "deleted_at"]),
  fish_categories: new Set(["id", "company_id", "name", "default_unit", "notes", "created_at", "deleted_at"]),
  fish_quality_levels: new Set([
    "id", "company_id", "fish_category_id", "name", "default_price", "created_at", "deleted_at",
  ]),
  expense_categories: new Set(["id", "company_id", "name", "is_default", "created_at", "deleted_at"]),
  buyers: new Set(["id", "company_id", "name", "phone", "notes", "created_at", "deleted_at"]),
  trips: new Set([
    "id", "company_id", "boat_id", "captain_name", "departure_date",
    "expected_return_date", "actual_return_date", "status",
    "crew_payment_method", "notes", "created_at", "updated_at", "deleted_at",
  ]),
  trip_crew: new Set([
    "id", "company_id", "trip_id", "crew_member_id", "payment_type",
    "fixed_amount", "percentage", "computed_amount",
  ]),
  expenses: new Set([
    "id", "company_id", "trip_id", "expense_category_id", "amount", "date",
    "description", "photo_url", "photo_local_status", "created_at",
  ]),
  catches: new Set([
    "id", "company_id", "trip_id", "fish_category_id", "fish_quality_level_id",
    "quantity", "unit", "estimated_price", "created_at",
  ]),
  sales: new Set([
    "id", "company_id", "trip_id", "buyer_id", "fish_category_id",
    "fish_quality_level_id", "quantity", "sale_price", "total_amount", "date", "created_at",
  ]),
  sale_payments: new Set(["id", "company_id", "sale_id", "amount", "date", "notes", "created_at"]),
  settings: new Set(["id", "company_id", "default_crew_payment_method", "currency", "language"]),
};

export function assertSyncableTable(table: string): void {
  if (!TABLE_COLUMNS[table]) {
    throw new SyncWriteError("42P01", `Table non autorisée pour la synchro : "${table}"`);
  }
}

export interface SyncOperation {
  table: string;
  op: "PUT" | "PATCH" | "DELETE";
  id: string;
  data?: Record<string, unknown>;
}

export interface SyncQuery {
  text: string;
  values: unknown[];
}

export function buildSyncQuery(operation: SyncOperation): SyncQuery {
  const { table, op, id, data } = operation;
  const allowedColumns = TABLE_COLUMNS[table];
  if (!allowedColumns) {
    throw new SyncWriteError("42P01", `Table non autorisée pour la synchro : "${table}"`);
  }

  if (op === "DELETE") {
    return { text: `DELETE FROM ${table} WHERE id = $1`, values: [id] };
  }

  const record: Record<string, unknown> = { ...(data ?? {}), id };
  for (const column of Object.keys(record)) {
    if (!allowedColumns.has(column)) {
      throw new SyncWriteError("42703", `Colonne non autorisée sur "${table}" : "${column}"`);
    }
  }

  const columns = Object.keys(record);
  const values = columns.map((column) => record[column]);

  if (op === "PUT") {
    const placeholders = columns.map((_, index) => `$${index + 1}`);
    const updates = columns
      .filter((column) => column !== "id")
      .map((column) => `${column} = excluded.${column}`)
      .join(", ");
    return {
      text: `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders.join(", ")}) ON CONFLICT (id) DO UPDATE SET ${updates}`,
      values,
    };
  }

  // PATCH
  const patchColumns = columns.filter((column) => column !== "id");
  const setClauses = patchColumns.map((column, index) => `${column} = $${index + 1}`);
  const patchValues = patchColumns.map((column) => record[column]);
  return {
    text: `UPDATE ${table} SET ${setClauses.join(", ")} WHERE id = $${patchValues.length + 1}`,
    values: [...patchValues, id],
  };
}
```

- [ ] **Step 5: Lancer le test, vérifier qu'il passe**

Run: `npx vitest run lib/postgres/syncWrite.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/postgres/postgresErrorCodes.ts lib/postgres/syncWrite.ts lib/postgres/syncWrite.test.ts
git commit -m "server: ajoute la construction des requêtes de synchro (lib/postgres/syncWrite.ts)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 7: Hash du code de connexion (`lib/auth/passwords.ts`) — TDD

**Files:**
- Create: `lib/auth/passwords.ts`
- Test: `lib/auth/passwords.test.ts`

**Interfaces:**
- Produces: `hashLoginCode(code: string): Promise<string>`, `verifyLoginCode(code: string, hash: string): Promise<boolean>`.

- [ ] **Step 1: Écrire le test qui échoue**

```ts
// lib/auth/passwords.test.ts
import { describe, expect, it } from "vitest";
import { hashLoginCode, verifyLoginCode } from "./passwords";

describe("hashLoginCode / verifyLoginCode", () => {
  it("un hash vérifie correctement le code d'origine", async () => {
    const hash = await hashLoginCode("1234");
    expect(await verifyLoginCode("1234", hash)).toBe(true);
  });

  it("rejette un code différent", async () => {
    const hash = await hashLoginCode("1234");
    expect(await verifyLoginCode("9999", hash)).toBe(false);
  });

  it("produit un hash différent de la valeur en clair", async () => {
    const hash = await hashLoginCode("1234");
    expect(hash).not.toBe("1234");
  });
});
```

- [ ] **Step 2: Lancer le test, vérifier qu'il échoue**

Run: `npx vitest run lib/auth/passwords.test.ts`
Expected: FAIL — `Cannot find module './passwords'`.

- [ ] **Step 3: Implémenter `lib/auth/passwords.ts`**

```ts
// Hash du code de connexion à 4 chiffres (accepté comme risque assumé pour
// cet outil interne mono-admin — voir docs/superpowers/specs/...). bcrypt
// reste la bonne pratique même pour un secret court : ralentit le
// brute-force côté serveur en cas de fuite de la base.
import bcrypt from "bcryptjs";

const SALT_ROUNDS = 10;

export async function hashLoginCode(code: string): Promise<string> {
  return bcrypt.hash(code, SALT_ROUNDS);
}

export async function verifyLoginCode(code: string, hash: string): Promise<boolean> {
  return bcrypt.compare(code, hash);
}
```

- [ ] **Step 4: Lancer le test, vérifier qu'il passe**

Run: `npx vitest run lib/auth/passwords.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/auth/passwords.ts lib/auth/passwords.test.ts
git commit -m "auth: ajoute le hash bcrypt du code de connexion

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 8: JWT d'accès (`lib/auth/jwt.ts`, `lib/auth/verifyAccessToken.ts`) — TDD

**Files:**
- Create: `lib/auth/jwt.ts`
- Create: `lib/auth/verifyAccessToken.ts`
- Test: `lib/auth/jwt.test.ts`

**Interfaces:**
- Produces: `ACCESS_TOKEN_TTL_SECONDS: number`. `signAccessToken(payload: { sub: string; companyId: string; role: string }): Promise<string>`. `AccessTokenPayload = { sub: string; companyId: string; role: string }`. `verifyAccessToken(token: string): Promise<AccessTokenPayload>` (rejette avec une erreur si le token est invalide/expiré/mal signé).

- [ ] **Step 1: Écrire le test qui échoue**

```ts
// lib/auth/jwt.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { signAccessToken } from "./jwt";
import { verifyAccessToken } from "./verifyAccessToken";

describe("signAccessToken / verifyAccessToken", () => {
  beforeEach(() => {
    vi.stubEnv("JWT_SECRET", "test-secret-do-not-use-in-prod");
  });

  it("un token signé se vérifie et restitue les claims", async () => {
    const token = await signAccessToken({ sub: "user-1", companyId: "company-1", role: "owner" });
    const claims = await verifyAccessToken(token);
    expect(claims).toEqual({ sub: "user-1", companyId: "company-1", role: "owner" });
  });

  it("rejette un token signé avec un autre secret", async () => {
    const token = await signAccessToken({ sub: "user-1", companyId: "company-1", role: "owner" });
    vi.stubEnv("JWT_SECRET", "another-secret");
    await expect(verifyAccessToken(token)).rejects.toThrow();
  });

  it("rejette une chaîne qui n'est pas un JWT", async () => {
    await expect(verifyAccessToken("not-a-jwt")).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Lancer le test, vérifier qu'il échoue**

Run: `npx vitest run lib/auth/jwt.test.ts`
Expected: FAIL — modules introuvables.

- [ ] **Step 3: Implémenter `lib/auth/jwt.ts`**

```ts
// Émission des JWT d'accès (HS256, secret partagé JWT_SECRET). Ce même
// secret configure la "Client Auth" de l'instance PowerSync (voir
// docs/GETTING_STARTED.md) : PowerSync doit vérifier exactement les mêmes
// tokens que nos routes API.
import { SignJWT } from "jose";
import { requireEnv } from "@/lib/env";

export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60; // 1h

export interface AccessTokenPayload {
  sub: string;
  companyId: string;
  role: string;
}

export async function signAccessToken(payload: AccessTokenPayload): Promise<string> {
  const secret = new TextEncoder().encode(requireEnv("JWT_SECRET"));
  return new SignJWT({ companyId: payload.companyId, role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(secret);
}
```

- [ ] **Step 4: Implémenter `lib/auth/verifyAccessToken.ts`**

```ts
import { jwtVerify } from "jose";
import { requireEnv } from "@/lib/env";
import type { AccessTokenPayload } from "./jwt";

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  const secret = new TextEncoder().encode(requireEnv("JWT_SECRET"));
  const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });

  if (
    typeof payload.sub !== "string" ||
    typeof payload.companyId !== "string" ||
    typeof payload.role !== "string"
  ) {
    throw new Error("JWT invalide : claims manquants");
  }

  return { sub: payload.sub, companyId: payload.companyId, role: payload.role };
}
```

- [ ] **Step 5: Lancer le test, vérifier qu'il passe**

Run: `npx vitest run lib/auth/jwt.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/auth/jwt.ts lib/auth/verifyAccessToken.ts lib/auth/jwt.test.ts
git commit -m "auth: ajoute la signature/vérification JWT HS256

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 9: `lib/auth/phoneAuth.ts` — retrait de l'email synthétique — TDD

**Files:**
- Modify: `lib/auth/phoneAuth.ts`
- Test: `lib/auth/phoneAuth.test.ts`

**Interfaces:**
- Produces (inchangé) : `COUNTRY_CODE`, `isValidMauritanianPhone(digits: string): boolean`, `isValidLoginCode(code: string): boolean`.
- Removes: `toSyntheticEmail`, `deriveLoginPassword` (contournement Supabase Auth devenu inutile — voir spec §4).

- [ ] **Step 1: Écrire le test qui échoue**

```ts
// lib/auth/phoneAuth.test.ts
import { describe, expect, it } from "vitest";
import { isValidLoginCode, isValidMauritanianPhone } from "./phoneAuth";

describe("isValidMauritanianPhone", () => {
  it("accepte les préfixes Chinguitel/Mattel/Mauritel", () => {
    expect(isValidMauritanianPhone("23112233")).toBe(true);
    expect(isValidMauritanianPhone("33112233")).toBe(true);
    expect(isValidMauritanianPhone("44112233")).toBe(true);
  });

  it("rejette un préfixe inconnu", () => {
    expect(isValidMauritanianPhone("13112233")).toBe(false);
  });

  it("rejette une longueur incorrecte", () => {
    expect(isValidMauritanianPhone("3311223")).toBe(false);
    expect(isValidMauritanianPhone("331122334")).toBe(false);
  });
});

describe("isValidLoginCode", () => {
  it("accepte exactement 4 chiffres", () => {
    expect(isValidLoginCode("1234")).toBe(true);
  });

  it("rejette une longueur ou un contenu incorrect", () => {
    expect(isValidLoginCode("123")).toBe(false);
    expect(isValidLoginCode("12a4")).toBe(false);
  });
});
```

- [ ] **Step 2: Lancer le test, vérifier qu'il échoue**

Run: `npx vitest run lib/auth/phoneAuth.test.ts`
Expected: FAIL si `isValidMauritanianPhone`/`isValidLoginCode` n'existent pas encore sous cette forme — en pratique ils existent déjà (fichier actuel), donc ce test devrait déjà passer avant modification. Confirmer avec `npx vitest run lib/auth/phoneAuth.test.ts` que les 5 tests passent AVANT de toucher le fichier (base de référence), puis continuer.

- [ ] **Step 3: Éditer `lib/auth/phoneAuth.ts`**

Retirer entièrement les fonctions `toSyntheticEmail` et `deriveLoginPassword` ainsi que leurs commentaires associés. Fichier final :

```ts
// Authentification par numéro de téléphone mauritanien + code à 4 chiffres.
// Fonctions pures, sans dépendance React/Next — importées à la fois par le
// client (lib/auth/authClient.ts) et par les scripts Node (scripts/*.ts).

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
```

- [ ] **Step 4: Lancer le test, vérifier qu'il passe**

Run: `npx vitest run lib/auth/phoneAuth.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Chercher les usages restants des fonctions retirées**

Run: `grep -rn "toSyntheticEmail\|deriveLoginPassword" --include="*.ts" --include="*.tsx" . --exclude-dir=node_modules`
Expected: aucun résultat en dehors de `scripts/seed-owner.ts` et `scripts/update-owner-credentials.ts` (traités Tasks 21-22 — ne pas les casser avant ces tâches ; si ce grep tourne avant que ces scripts soient réécrits, le `npm run build`/`tsc` global échouera temporairement, ce qui est attendu à ce stade du plan et sera résolu Tasks 21-22).

- [ ] **Step 6: Commit**

```bash
git add lib/auth/phoneAuth.ts lib/auth/phoneAuth.test.ts
git commit -m "auth: retire l'email synthétique (devenu inutile sans Supabase Auth)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 10: Refresh tokens serveur (`lib/auth/refreshTokens.ts`)

**Files:**
- Create: `lib/auth/refreshTokens.ts`

**Interfaces:**
- Consumes: `getAdminPool()` (Task 4).
- Produces: `issueRefreshToken(userId: string): Promise<string>`, `consumeRefreshToken(token: string): Promise<{ userId: string } | null>` (rotation : supprime le token consommé), `revokeRefreshToken(token: string): Promise<void>`.

- [ ] **Step 1: Créer `lib/auth/refreshTokens.ts`**

```ts
// Refresh tokens stockés hachés (jamais en clair) dans public.refresh_tokens
// (db/migrations/20260806000000_refresh_tokens.sql). Rotation à chaque
// refresh : le token consommé est supprimé, un nouveau est émis par
// l'appelant — limite la fenêtre d'exploitation d'un token volé.
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { getAdminPool } from "@/lib/postgres/pool";

const REFRESH_TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 90; // 90 jours

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function issueRefreshToken(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await getAdminPool().query(
    `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)`,
    [randomUUID(), userId, hashToken(token), new Date(Date.now() + REFRESH_TOKEN_TTL_MS)],
  );
  return token;
}

export async function consumeRefreshToken(token: string): Promise<{ userId: string } | null> {
  const pool = getAdminPool();
  const { rows } = await pool.query<{ id: string; user_id: string; expires_at: Date }>(
    `SELECT id, user_id, expires_at FROM refresh_tokens WHERE token_hash = $1`,
    [hashToken(token)],
  );
  const row = rows[0];
  if (!row || row.expires_at.getTime() < Date.now()) return null;

  await pool.query(`DELETE FROM refresh_tokens WHERE id = $1`, [row.id]);
  return { userId: row.user_id };
}

export async function revokeRefreshToken(token: string): Promise<void> {
  await getAdminPool().query(`DELETE FROM refresh_tokens WHERE token_hash = $1`, [hashToken(token)]);
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/auth/refreshTokens.ts
git commit -m "auth: ajoute la gestion des refresh tokens (rotation, révocation)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 11: Route `/api/auth/login`

**Files:**
- Create: `app/api/auth/login/route.ts`

**Interfaces:**
- Consumes: `isValidMauritanianPhone`/`isValidLoginCode` (Task 9), `verifyLoginCode` (Task 7), `signAccessToken` (Task 8), `issueRefreshToken` (Task 10), `getAdminPool` (Task 4).
- Produces: `POST /api/auth/login` `{phone, code}` → `200 {accessToken, refreshToken, expiresAt, user: {id}}` ou `401 {error}`.

- [ ] **Step 1: Créer `app/api/auth/login/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { getAdminPool } from "@/lib/postgres/pool";
import { verifyLoginCode } from "@/lib/auth/passwords";
import { signAccessToken, ACCESS_TOKEN_TTL_SECONDS } from "@/lib/auth/jwt";
import { issueRefreshToken } from "@/lib/auth/refreshTokens";
import { isValidLoginCode, isValidMauritanianPhone } from "@/lib/auth/phoneAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface UserRow {
  id: string;
  company_id: string;
  role: string;
  code_hash: string;
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const phone = typeof body?.phone === "string" ? body.phone : "";
  const code = typeof body?.code === "string" ? body.code : "";

  if (!isValidMauritanianPhone(phone) || !isValidLoginCode(code)) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const { rows } = await getAdminPool().query<UserRow>(
    `SELECT id, company_id, role, code_hash FROM users WHERE phone = $1`,
    [phone],
  );
  const user = rows[0];

  if (!user || !(await verifyLoginCode(code, user.code_hash))) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const accessToken = await signAccessToken({ sub: user.id, companyId: user.company_id, role: user.role });
  const refreshToken = await issueRefreshToken(user.id);

  return NextResponse.json({
    accessToken,
    refreshToken,
    expiresAt: Date.now() + ACCESS_TOKEN_TTL_SECONDS * 1000,
    user: { id: user.id },
  });
}
```

- [ ] **Step 2: Vérification manuelle**

Prérequis : au moins un owner en base (à faire réellement après Task 21 — seed-owner réécrit ; pour l'instant, insérer une ligne de test à la main) :
```bash
docker compose exec postgres psql -U postgres -d fbms -c \
  "INSERT INTO companies (id, name) VALUES (gen_random_uuid(), 'Test') RETURNING id;"
```
Récupérer l'id retourné (`COMPANY_ID`), puis :
```bash
node -e "console.log(require('bcryptjs').hashSync('1234', 10))"
```
```bash
docker compose exec postgres psql -U postgres -d fbms -c \
  "INSERT INTO users (id, company_id, name, phone, code_hash, role) VALUES (gen_random_uuid(), 'COMPANY_ID', 'Test Owner', '33112233', 'HASH_ICI', 'owner');"
```

Run: `npm run dev`, puis dans un autre terminal :
```bash
curl -s -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"phone":"33112233","code":"1234"}'
```
Expected: JSON avec `accessToken`, `refreshToken`, `expiresAt`, `user.id`. Un mauvais code renvoie `401 {"error":"invalid_credentials"}`.

- [ ] **Step 3: Commit**

```bash
git add app/api/auth/login/route.ts
git commit -m "auth: ajoute POST /api/auth/login

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 12: Routes `/api/auth/refresh` et `/api/auth/logout`

**Files:**
- Create: `app/api/auth/refresh/route.ts`
- Create: `app/api/auth/logout/route.ts`

**Interfaces:**
- Consumes: `consumeRefreshToken`/`issueRefreshToken`/`revokeRefreshToken` (Task 10), `signAccessToken` (Task 8), `getAdminPool` (Task 4).
- Produces: `POST /api/auth/refresh` `{refreshToken}` → `200 {accessToken, refreshToken, expiresAt, user}` ou `401`. `POST /api/auth/logout` `{refreshToken}` → `200 {ok: true}` (toujours, même si le token était déjà invalide).

- [ ] **Step 1: Créer `app/api/auth/refresh/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { getAdminPool } from "@/lib/postgres/pool";
import { signAccessToken, ACCESS_TOKEN_TTL_SECONDS } from "@/lib/auth/jwt";
import { consumeRefreshToken, issueRefreshToken } from "@/lib/auth/refreshTokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface UserRow {
  id: string;
  company_id: string;
  role: string;
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const refreshToken = typeof body?.refreshToken === "string" ? body.refreshToken : "";
  if (!refreshToken) {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }

  const consumed = await consumeRefreshToken(refreshToken);
  if (!consumed) {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }

  const { rows } = await getAdminPool().query<UserRow>(
    `SELECT id, company_id, role FROM users WHERE id = $1`,
    [consumed.userId],
  );
  const user = rows[0];
  if (!user) {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }

  const accessToken = await signAccessToken({ sub: user.id, companyId: user.company_id, role: user.role });
  const newRefreshToken = await issueRefreshToken(user.id);

  return NextResponse.json({
    accessToken,
    refreshToken: newRefreshToken,
    expiresAt: Date.now() + ACCESS_TOKEN_TTL_SECONDS * 1000,
    user: { id: user.id },
  });
}
```

- [ ] **Step 2: Créer `app/api/auth/logout/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { revokeRefreshToken } from "@/lib/auth/refreshTokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const refreshToken = typeof body?.refreshToken === "string" ? body.refreshToken : "";
  if (refreshToken) {
    await revokeRefreshToken(refreshToken);
  }
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Vérification manuelle**

En réutilisant le `refreshToken` obtenu Task 11 :
```bash
curl -s -X POST http://localhost:3000/api/auth/refresh -H "Content-Type: application/json" -d '{"refreshToken":"REFRESH_TOKEN_ICI"}'
```
Expected: nouveau `accessToken`/`refreshToken`. Rejouer la même commande avec le même (ancien) `refreshToken` :
Expected: `401 {"error":"invalid_token"}` (rotation — le token consommé est supprimé).

```bash
curl -s -X POST http://localhost:3000/api/auth/logout -H "Content-Type: application/json" -d '{"refreshToken":"UN_TOKEN_VALIDE"}'
```
Expected: `{"ok":true}`.

- [ ] **Step 4: Commit**

```bash
git add app/api/auth/refresh/route.ts app/api/auth/logout/route.ts
git commit -m "auth: ajoute POST /api/auth/refresh et /api/auth/logout

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 13: Session client (`lib/auth/session.ts`) — TDD

**Files:**
- Create: `lib/auth/session.ts`
- Test: `lib/auth/session.test.ts`

**Interfaces:**
- Produces: `interface Session { accessToken: string; refreshToken: string; expiresAt: number; user: { id: string } }`. `readSession(): Session | null`. `writeSession(session: Session): void`. `clearSession(): void`. `subscribeSessionChange(listener: () => void): () => void`. `needsRefresh(session: Session): boolean`.

- [ ] **Step 1: Écrire le test qui échoue**

```ts
// lib/auth/session.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearSession, needsRefresh, readSession, subscribeSessionChange, writeSession } from "./session";

function memoryLocalStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => void store.set(key, value),
    removeItem: (key) => void store.delete(key),
    clear: () => store.clear(),
    key: () => null,
    get length() {
      return store.size;
    },
  };
}

const SESSION = {
  accessToken: "a",
  refreshToken: "r",
  expiresAt: Date.now() + 60_000,
  user: { id: "u1" },
};

describe("session storage", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", memoryLocalStorage());
  });

  it("retourne null si rien n'est stocké", () => {
    expect(readSession()).toBeNull();
  });

  it("écrit puis relit la même session", () => {
    writeSession(SESSION);
    expect(readSession()).toEqual(SESSION);
  });

  it("clearSession efface la session stockée", () => {
    writeSession(SESSION);
    clearSession();
    expect(readSession()).toBeNull();
  });

  it("notifie les abonnés à chaque écriture/effacement", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeSessionChange(listener);
    writeSession(SESSION);
    clearSession();
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });
});

describe("needsRefresh", () => {
  it("faux pour une session encore loin de l'expiration", () => {
    expect(needsRefresh({ ...SESSION, expiresAt: Date.now() + 60 * 60 * 1000 })).toBe(false);
  });

  it("vrai pour une session déjà expirée", () => {
    expect(needsRefresh({ ...SESSION, expiresAt: Date.now() - 1000 })).toBe(true);
  });

  it("vrai dans la marge de rafraîchissement anticipé (5 min avant expiration)", () => {
    expect(needsRefresh({ ...SESSION, expiresAt: Date.now() + 60 * 1000 })).toBe(true);
  });
});
```

- [ ] **Step 2: Lancer le test, vérifier qu'il échoue**

Run: `npx vitest run lib/auth/session.test.ts`
Expected: FAIL — `Cannot find module './session'`.

- [ ] **Step 3: Implémenter `lib/auth/session.ts`**

```ts
// Session persistée en localStorage, condition nécessaire pour que l'app
// s'ouvre hors-ligne après un premier login (voir PROJECT_PLAN §6) —
// remplace la gestion interne de @supabase/supabase-js
// (persistSession/autoRefreshToken). subscribeSessionChange() remplace
// supabase.auth.onAuthStateChange() : AuthProvider (Task 15) s'y abonne
// pour refléter un login/logout déclenché ailleurs (lib/auth/authClient.ts).
export interface Session {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: { id: string };
}

const STORAGE_KEY = "fbms:session";
const EXPIRY_MARGIN_MS = 5 * 60 * 1000;

type Listener = () => void;
const listeners = new Set<Listener>();

function storage(): Storage | null {
  return typeof localStorage === "undefined" ? null : localStorage;
}

function notify(): void {
  listeners.forEach((listener) => listener());
}

export function readSession(): Session | null {
  const raw = storage()?.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export function writeSession(session: Session): void {
  storage()?.setItem(STORAGE_KEY, JSON.stringify(session));
  notify();
}

export function clearSession(): void {
  storage()?.removeItem(STORAGE_KEY);
  notify();
}

export function subscribeSessionChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function needsRefresh(session: Session): boolean {
  return session.expiresAt - EXPIRY_MARGIN_MS < Date.now();
}
```

- [ ] **Step 4: Lancer le test, vérifier qu'il passe**

Run: `npx vitest run lib/auth/session.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/auth/session.ts lib/auth/session.test.ts
git commit -m "auth: ajoute la persistance de session localStorage (lib/auth/session.ts)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 14: Client d'authentification (`lib/auth/authClient.ts`)

**Files:**
- Create: `lib/auth/authClient.ts`

**Interfaces:**
- Consumes: `Session`, `readSession`, `writeSession`, `clearSession` (Task 13).
- Produces: `signIn(phoneDigits: string, code: string): Promise<Session>`, `signOut(): Promise<void>`, `refreshSession(session: Session): Promise<Session>`.

- [ ] **Step 1: Créer `lib/auth/authClient.ts`**

```ts
// Remplace lib/supabase/auth.ts. `phoneDigits` : 8 chiffres locaux, déjà
// validés côté formulaire (voir app/(auth)/login/page.tsx).
import { clearSession, readSession, writeSession, type Session } from "./session";

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: { id: string };
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Requête ${path} échouée (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export async function signIn(phoneDigits: string, code: string): Promise<Session> {
  const session = await postJson<AuthResponse>("/api/auth/login", { phone: phoneDigits, code });
  writeSession(session);
  return session;
}

export async function signOut(): Promise<void> {
  const session = readSession();
  clearSession();
  if (session) {
    // Best effort : la session locale est déjà effacée, un échec réseau ne
    // doit pas bloquer la déconnexion côté app.
    await fetch("/api/auth/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: session.refreshToken }),
    }).catch(() => {});
  }
}

export async function refreshSession(session: Session): Promise<Session> {
  const next = await postJson<AuthResponse>("/api/auth/refresh", {
    refreshToken: session.refreshToken,
  });
  writeSession(next);
  return next;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/auth/authClient.ts
git commit -m "auth: ajoute lib/auth/authClient.ts (signIn/signOut/refreshSession)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 15: `AuthProvider` + bascule de tous les consommateurs

**Files:**
- Create: `lib/auth/AuthProvider.tsx`
- Modify: `app/layout.tsx:4`
- Modify: `app/(app)/layout.tsx:6`
- Modify: `app/(app)/page.tsx:16`
- Modify: `app/(auth)/login/page.tsx:5-6`
- Modify: `lib/powersync/PowerSyncProvider.tsx:8`
- Modify: `lib/auth/useCompanyId.ts:4`

**Interfaces:**
- Consumes: `Session`, `readSession`, `needsRefresh`, `subscribeSessionChange` (Task 13), `refreshSession` (Task 14).
- Produces: `useSession(): { session: Session | null; loading: boolean }` (même forme que l'ancien `lib/supabase/AuthProvider.tsx`, donc `session.user.id` reste valide pour `useCompanyId.ts`).

- [ ] **Step 1: Créer `lib/auth/AuthProvider.tsx`**

```tsx
"use client";

// Remplace lib/supabase/AuthProvider.tsx. Lit la session persistée au
// montage (offline-first : pas d'appel réseau nécessaire pour ouvrir
// l'app), puis tente un rafraîchissement silencieux en arrière-plan quand
// le token approche l'expiration ET que le réseau est disponible — même
// contrat que "token refresh happens silently when back online" (PROJECT_PLAN
// §6). Un échec de refresh (hors-ligne, refresh token expiré) ne vide pas
// la session : l'app reste utilisable hors-ligne jusqu'au prochain succès.
import { createContext, useContext, useEffect, useState } from "react";
import { needsRefresh, readSession, subscribeSessionChange, type Session } from "./session";
import { refreshSession } from "./authClient";

interface AuthContextValue {
  session: Session | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue>({ session: null, loading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setSession(readSession());
    setLoading(false);
    return subscribeSessionChange(() => setSession(readSession()));
  }, []);

  useEffect(() => {
    if (!session || typeof navigator === "undefined") return;

    async function maybeRefresh() {
      if (!navigator.onLine || !needsRefresh(session!)) return;
      try {
        await refreshSession(session!);
      } catch {
        // Voir commentaire d'en-tête : on garde la session actuelle.
      }
    }

    void maybeRefresh();
    window.addEventListener("online", maybeRefresh);
    return () => window.removeEventListener("online", maybeRefresh);
  }, [session]);

  return <AuthContext.Provider value={{ session, loading }}>{children}</AuthContext.Provider>;
}

export function useSession(): AuthContextValue {
  return useContext(AuthContext);
}
```

- [ ] **Step 2: Basculer les imports dans `app/layout.tsx`**

Remplacer `import { AuthProvider } from "@/lib/supabase/AuthProvider";` par :
```ts
import { AuthProvider } from "@/lib/auth/AuthProvider";
```

- [ ] **Step 3: Basculer les imports dans `app/(app)/layout.tsx`**

Remplacer `import { useSession } from "@/lib/supabase/AuthProvider";` par :
```ts
import { useSession } from "@/lib/auth/AuthProvider";
```

- [ ] **Step 4: Basculer les imports dans `app/(auth)/login/page.tsx`**

Remplacer :
```ts
import { useSession } from "@/lib/supabase/AuthProvider";
import { signIn } from "@/lib/supabase/auth";
```
par :
```ts
import { useSession } from "@/lib/auth/AuthProvider";
import { signIn } from "@/lib/auth/authClient";
```

- [ ] **Step 5: Basculer l'import dans `app/(app)/page.tsx`**

Remplacer `import { signOut } from "@/lib/supabase/auth";` par :
```ts
import { signOut } from "@/lib/auth/authClient";
```

- [ ] **Step 6: Basculer les imports dans `lib/powersync/PowerSyncProvider.tsx`**

Remplacer `import { useSession } from "@/lib/supabase/AuthProvider";` par :
```ts
import { useSession } from "@/lib/auth/AuthProvider";
```
Mettre à jour les commentaires de ce fichier qui mentionnent "session Supabase" pour dire "session" (le fonctionnement décrit reste identique — connexion/déconnexion PowerSync suit toujours l'état de la session, indépendamment du fournisseur).

- [ ] **Step 7: Basculer les imports dans `lib/auth/useCompanyId.ts`**

Remplacer `import { useSession } from "@/lib/supabase/AuthProvider";` par :
```ts
import { useSession } from "@/lib/auth/AuthProvider";
```

- [ ] **Step 8: Vérification — build TypeScript**

Run: `npx tsc --noEmit`
Expected: aucune erreur provenant des fichiers modifiés ci-dessus liée à `useSession`/`signIn`/`signOut` (des erreurs peuvent subsister dans `lib/powersync/BackendConnector.ts`, `lib/sync/photoUploadQueue.ts`, `scripts/seed-owner.ts`, `scripts/update-owner-credentials.ts` — traités Tasks 16-22, attendu à ce stade).

- [ ] **Step 9: Commit**

```bash
git add lib/auth/AuthProvider.tsx app/layout.tsx "app/(app)/layout.tsx" "app/(app)/page.tsx" "app/(auth)/login/page.tsx" lib/powersync/PowerSyncProvider.tsx lib/auth/useCompanyId.ts
git commit -m "auth: bascule tous les consommateurs vers lib/auth/AuthProvider

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 16: Route `/api/sync/write`

**Files:**
- Create: `app/api/sync/write/route.ts`

**Interfaces:**
- Consumes: `verifyAccessToken` (Task 8), `assertSyncableTable`/`buildSyncQuery`/`SyncWriteError` (Task 6), `NON_RETRYABLE_POSTGRES_ERROR_CODES` (Task 6), `withCompanyContext` (Task 5).
- Produces: `POST /api/sync/write` (header `Authorization: Bearer <token>`, body `{table, op, id, data}`) → `200 {ok: true}` ou erreur JSON `{code, message}` avec un status HTTP reflétant si l'erreur est non-retryable (`409`) ou transitoire (`500`)/`401` (auth).

- [ ] **Step 1: Créer `app/api/sync/write/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "@/lib/auth/verifyAccessToken";
import { withCompanyContext } from "@/lib/postgres/withCompanyContext";
import { buildSyncQuery, SyncWriteError, type SyncOperation } from "@/lib/postgres/syncWrite";
import { NON_RETRYABLE_POSTGRES_ERROR_CODES } from "@/lib/postgres/postgresErrorCodes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bearerToken(request: NextRequest): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length);
}

function isSyncOp(value: unknown): value is SyncOperation["op"] {
  return value === "PUT" || value === "PATCH" || value === "DELETE";
}

export async function POST(request: NextRequest) {
  const token = bearerToken(request);
  if (!token) {
    return NextResponse.json({ code: "42501", message: "Authentification requise" }, { status: 401 });
  }

  let claims;
  try {
    claims = await verifyAccessToken(token);
  } catch {
    return NextResponse.json({ code: "42501", message: "Jeton invalide ou expiré" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body.table !== "string" || !isSyncOp(body.op) || typeof body.id !== "string") {
    return NextResponse.json({ code: "22P02", message: "Requête de synchro malformée" }, { status: 400 });
  }

  try {
    const query = buildSyncQuery({ table: body.table, op: body.op, id: body.id, data: body.data });
    await withCompanyContext(claims.sub, claims.companyId, (client) => client.query(query.text, query.values));
    return NextResponse.json({ ok: true });
  } catch (error) {
    const code = error instanceof SyncWriteError ? error.code : (error as { code?: string })?.code;
    const message = error instanceof Error ? error.message : "Erreur de synchro";
    const status = code && NON_RETRYABLE_POSTGRES_ERROR_CODES.has(code) ? 409 : 500;
    return NextResponse.json({ code: code ?? "UNKNOWN", message }, { status });
  }
}
```

- [ ] **Step 2: Vérification manuelle**

Avec un `accessToken` valide (Task 11) et un `COMPANY_ID` correspondant au user de test :
```bash
curl -s -X POST http://localhost:3000/api/sync/write \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ACCESS_TOKEN_ICI" \
  -d '{"table":"boats","op":"PUT","id":"11111111-1111-1111-1111-111111111111","data":{"company_id":"COMPANY_ID_ICI","name":"Test Boat","status":"active"}}'
```
Expected: `{"ok":true}`. Vérifier en base :
```bash
docker compose exec postgres psql -U postgres -d fbms -c "SELECT id, name, status FROM boats;"
```
Expected: la ligne insérée apparaît. Réessayer avec un `company_id` différent de celui du token :
Expected: `409` avec `code: "42501"` (violation RLS).

- [ ] **Step 3: Commit**

```bash
git add app/api/sync/write/route.ts
git commit -m "sync: ajoute POST /api/sync/write (remplace l'API PostgREST)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 17: `BackendConnector` — bascule vers `/api/sync/write`

**Files:**
- Modify: `lib/powersync/BackendConnector.ts` (réécriture complète)

**Interfaces:**
- Consumes: `readSession` (Task 13), `NON_RETRYABLE_POSTGRES_ERROR_CODES` (Task 6).
- Produces (inchangé) : `class BackendConnector implements PowerSyncBackendConnector` — mêmes méthodes `fetchCredentials()`/`uploadData()`, même comportement de retry.

- [ ] **Step 1: Réécrire `lib/powersync/BackendConnector.ts`**

```ts
import {
  AbstractPowerSyncDatabase,
  PowerSyncBackendConnector,
  PowerSyncCredentials,
  UpdateType,
} from "@powersync/web";
import { readSession } from "@/lib/auth/session";
import { NON_RETRYABLE_POSTGRES_ERROR_CODES } from "@/lib/postgres/postgresErrorCodes";

const powersyncUrl = process.env.NEXT_PUBLIC_POWERSYNC_URL;

function isNonRetryableError(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" && NON_RETRYABLE_POSTGRES_ERROR_CODES.has(code);
}

class SyncWriteRequestError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}

async function syncWrite(
  table: string,
  op: UpdateType,
  id: string,
  data?: Record<string, unknown>,
): Promise<void> {
  const session = readSession();
  if (!session) {
    throw new Error("Aucune session active — connexion requise");
  }

  const response = await fetch("/api/sync/write", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.accessToken}`,
    },
    body: JSON.stringify({ table, op, id, data }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new SyncWriteRequestError(body.message ?? `Échec de synchro (${response.status})`, body.code);
  }
}

export class BackendConnector implements PowerSyncBackendConnector {
  async fetchCredentials(): Promise<PowerSyncCredentials> {
    if (!powersyncUrl) {
      throw new Error(
        "NEXT_PUBLIC_POWERSYNC_URL doit être défini (voir .env.example)",
      );
    }

    const session = readSession();
    if (!session) {
      throw new Error("Aucune session active — connexion requise");
    }

    return {
      endpoint: powersyncUrl,
      token: session.accessToken,
    };
  }

  async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
    const transaction = await database.getNextCrudTransaction();
    if (!transaction) return;

    for (const op of transaction.crud) {
      try {
        await syncWrite(op.table, op.op, op.id, op.opData);
      } catch (error) {
        if (isNonRetryableError(error)) {
          // Erreur permanente (RLS, contrainte, donnée invalide...) :
          // réessayer ne changera rien. On l'écarte pour ne pas bloquer
          // indéfiniment le reste de la file de synchro.
          console.warn(
            `[SYNC] Écriture locale rejetée définitivement et écartée — table="${op.table}" op="${op.op}" id="${op.id}"`,
            { opData: op.opData, error },
          );
          continue;
        }

        // Erreur réseau/transitoire : ne pas compléter la transaction,
        // PowerSync retentera automatiquement ce même lot à la prochaine
        // tentative de synchronisation.
        console.error("Échec de synchronisation des écritures locales", error);
        throw error;
      }
    }

    await transaction.complete();
  }
}
```

- [ ] **Step 2: Vérification — build TypeScript**

Run: `npx tsc --noEmit`
Expected: aucune erreur sur `lib/powersync/BackendConnector.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/powersync/BackendConnector.ts
git commit -m "sync: BackendConnector appelle /api/sync/write au lieu de PostgREST

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 18: Client MinIO (`lib/storage/minioClient.ts`) — TDD partiel

**Files:**
- Create: `lib/storage/minioClient.ts`
- Create: `scripts/init-minio.ts`
- Test: `lib/storage/minioClient.test.ts`
- Modify: `package.json` (script `init-storage`)

**Interfaces:**
- Produces: `getMinioClient(): Client`, `PHOTOS_BUCKET: string`, `expensePhotoObjectPath(companyId: string, expenseId: string): string`.

- [ ] **Step 1: Écrire le test qui échoue (partie pure)**

```ts
// lib/storage/minioClient.test.ts
import { describe, expect, it } from "vitest";
import { expensePhotoObjectPath } from "./minioClient";

describe("expensePhotoObjectPath", () => {
  it("construit le chemin company_id/expense_id.jpg", () => {
    expect(expensePhotoObjectPath("c1", "e1")).toBe("c1/e1.jpg");
  });
});
```

- [ ] **Step 2: Lancer le test, vérifier qu'il échoue**

Run: `npx vitest run lib/storage/minioClient.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Implémenter `lib/storage/minioClient.ts`**

```ts
// Remplace Supabase Storage. Même convention de chemin qu'avant
// ({company_id}/{expense_id}.jpg) pour ne rien changer côté
// lib/sync/photoUploadQueue.ts au-delà du transport.
import { Client } from "minio";
import { requireEnv } from "@/lib/env";

export const PHOTOS_BUCKET = process.env.MINIO_BUCKET ?? "expense-photos";

let client: Client | null = null;

export function getMinioClient(): Client {
  if (!client) {
    client = new Client({
      endPoint: requireEnv("MINIO_ENDPOINT"),
      port: Number(requireEnv("MINIO_PORT")),
      useSSL: process.env.MINIO_USE_SSL === "true",
      accessKey: requireEnv("MINIO_ACCESS_KEY"),
      secretKey: requireEnv("MINIO_SECRET_KEY"),
    });
  }
  return client;
}

export function expensePhotoObjectPath(companyId: string, expenseId: string): string {
  return `${companyId}/${expenseId}.jpg`;
}
```

- [ ] **Step 4: Lancer le test, vérifier qu'il passe**

Run: `npx vitest run lib/storage/minioClient.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Créer `scripts/init-minio.ts`**

```ts
// Crée le bucket privé pour les photos de dépenses si absent — à exécuter
// une fois après le premier `docker compose up` (local ou VPS). Remplace
// la migration SQL `storage.buckets` de Supabase.
//
// Usage : npm run init-storage

import { getMinioClient, PHOTOS_BUCKET } from "../lib/storage/minioClient";

async function main() {
  const client = getMinioClient();
  const exists = await client.bucketExists(PHOTOS_BUCKET).catch(() => false);
  if (exists) {
    console.log(`Bucket "${PHOTOS_BUCKET}" déjà présent.`);
    return;
  }
  await client.makeBucket(PHOTOS_BUCKET);
  console.log(`✅ Bucket "${PHOTOS_BUCKET}" créé.`);
}

main().catch((error) => {
  console.error("❌ Échec de l'initialisation MinIO :", error.message ?? error);
  process.exit(1);
});
```

- [ ] **Step 6: Ajouter le script npm**

Dans `package.json` `scripts` :
```json
    "init-storage": "tsx --env-file=.env.local scripts/init-minio.ts",
```

- [ ] **Step 7: Vérification manuelle**

Run: `npm run init-storage`
Expected: `✅ Bucket "expense-photos" créé.` Rejouer : `Bucket "expense-photos" déjà présent.` Vérifier sur la console MinIO (`http://localhost:9001`, identifiants `MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD`) que le bucket `expense-photos` existe.

- [ ] **Step 8: Commit**

```bash
git add lib/storage/minioClient.ts lib/storage/minioClient.test.ts scripts/init-minio.ts package.json
git commit -m "storage: ajoute le client MinIO et l'init du bucket photos

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 19: Routes proxy photos (`/api/photos/upload`, `/api/photos/[...path]`)

**Files:**
- Create: `app/api/photos/upload/route.ts`
- Create: `app/api/photos/[...path]/route.ts`

**Interfaces:**
- Consumes: `verifyAccessToken` (Task 8), `getMinioClient`/`PHOTOS_BUCKET`/`expensePhotoObjectPath` (Task 18).
- Produces: `POST /api/photos/upload` (headers `Authorization`, `X-Expense-Id`, body = blob) → `200 {path}`. `GET /api/photos/{companyId}/{expenseId}.jpg` (header `Authorization`) → flux image ou `403`/`404`.

- [ ] **Step 1: Créer `app/api/photos/upload/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "@/lib/auth/verifyAccessToken";
import { expensePhotoObjectPath, getMinioClient, PHOTOS_BUCKET } from "@/lib/storage/minioClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let claims;
  try {
    claims = await verifyAccessToken(header.slice("Bearer ".length));
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const expenseId = request.headers.get("x-expense-id");
  if (!expenseId) {
    return NextResponse.json({ error: "missing_expense_id" }, { status: 400 });
  }

  const buffer = Buffer.from(await request.arrayBuffer());
  const objectPath = expensePhotoObjectPath(claims.companyId, expenseId);

  await getMinioClient().putObject(PHOTOS_BUCKET, objectPath, buffer, buffer.length, {
    "Content-Type": request.headers.get("content-type") ?? "image/jpeg",
  });

  return NextResponse.json({ path: objectPath });
}
```

- [ ] **Step 2: Créer `app/api/photos/[...path]/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "@/lib/auth/verifyAccessToken";
import { getMinioClient, PHOTOS_BUCKET } from "@/lib/storage/minioClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let claims;
  try {
    claims = await verifyAccessToken(header.slice("Bearer ".length));
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { path } = await params;
  const objectPath = path.join("/");
  if (!objectPath.startsWith(`${claims.companyId}/`)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const stream = await getMinioClient().getObject(PHOTOS_BUCKET, objectPath);
    return new NextResponse(stream as unknown as ReadableStream, {
      headers: { "Content-Type": "image/jpeg" },
    });
  } catch {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
}
```

- [ ] **Step 3: Vérification manuelle**

```bash
curl -s -X POST http://localhost:3000/api/photos/upload \
  -H "Authorization: Bearer ACCESS_TOKEN_ICI" \
  -H "X-Expense-Id: expense-test-1" \
  -H "Content-Type: image/jpeg" \
  --data-binary @/chemin/vers/une/photo.jpg
```
Expected: `{"path":"COMPANY_ID/expense-test-1.jpg"}`.
```bash
curl -s -o /tmp/downloaded.jpg -w "%{http_code}\n" \
  -H "Authorization: Bearer ACCESS_TOKEN_ICI" \
  http://localhost:3000/api/photos/COMPANY_ID/expense-test-1.jpg
```
Expected: `200`, `/tmp/downloaded.jpg` s'ouvre comme une image identique à l'originale.

- [ ] **Step 4: Commit**

```bash
git add app/api/photos
git commit -m "storage: ajoute les routes proxy /api/photos/upload et /api/photos/[...path]

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 20: `photoUploadQueue.ts` — bascule vers `/api/photos/upload`

**Files:**
- Modify: `lib/sync/photoUploadQueue.ts:1-11,90-98`

**Interfaces:**
- Consumes: `readSession` (Task 13).
- Produces (inchangé) : `queuePhotoForUpload`, `processUploadQueue`, `registerPhotoUploadQueueListener` — même comportement (file IndexedDB, retry avec backoff).

- [ ] **Step 1: Éditer l'en-tête et l'import de `lib/sync/photoUploadQueue.ts`**

Remplacer :
```ts
import type { AbstractPowerSyncDatabase } from "@powersync/web";
import { supabase } from "@/lib/supabase/client";
```
par :
```ts
import type { AbstractPowerSyncDatabase } from "@powersync/web";
import { readSession } from "@/lib/auth/session";
```

Mettre à jour le commentaire d'en-tête du fichier : remplacer "tente l'upload vers Supabase Storage" par "tente l'upload via /api/photos/upload (MinIO)".

- [ ] **Step 2: Remplacer l'appel d'upload dans `processUploadQueue`**

Remplacer :
```ts
      const path = `${item.companyId}/${item.expenseId}.jpg`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, item.blob, {
        upsert: true,
        contentType: item.blob.type || "image/jpeg",
      });
      if (error) throw error;
```
par :
```ts
      const session = readSession();
      if (!session) throw new Error("Aucune session active — connexion requise");

      const response = await fetch("/api/photos/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          "Content-Type": item.blob.type || "image/jpeg",
          "X-Expense-Id": item.expenseId,
        },
        body: item.blob,
      });
      if (!response.ok) throw new Error(`Échec de l'upload (${response.status})`);
      const { path } = (await response.json()) as { path: string };
```

Retirer la constante `const BUCKET = "expense-photos";` (Step suivant) — elle n'est plus utilisée, `PHOTOS_BUCKET` vit maintenant côté serveur uniquement (`lib/storage/minioClient.ts`).

- [ ] **Step 3: Retirer la constante `BUCKET` devenue inutile**

Supprimer la ligne `const BUCKET = "expense-photos";`.

- [ ] **Step 4: Vérification — build TypeScript**

Run: `npx tsc --noEmit`
Expected: aucune erreur sur `lib/sync/photoUploadQueue.ts`.

- [ ] **Step 5: Vérification manuelle end-to-end**

Dans l'app (`npm run dev`, connecté), créer une dépense avec photo. Couper le réseau (DevTools → Network → Offline), vérifier que la dépense est créée localement avec `photo_local_status = 'pending_upload'`. Rétablir le réseau : vérifier dans la console MinIO que le fichier apparaît sous `{company_id}/{expense_id}.jpg`, et que `photo_local_status` passe à `'uploaded'` dans PowerSync (SQLite local, visible via les DevTools ou une requête `SELECT photo_local_status FROM expenses`).

- [ ] **Step 6: Commit**

```bash
git add lib/sync/photoUploadQueue.ts
git commit -m "storage: photoUploadQueue upload via /api/photos/upload (MinIO)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 21: `scripts/seed-owner.ts` réécrit

**Files:**
- Modify: `scripts/seed-owner.ts` (réécriture complète)

**Interfaces:**
- Consumes: `hashLoginCode` (Task 7), `isValidLoginCode`/`isValidMauritanianPhone` (Task 9).
- Produces (inchangé) : `npm run seed -- --company "..." --name "..." --phone "..." --code "...`" crée company + owner + settings + 8 catégories de dépenses par défaut.

- [ ] **Step 1: Réécrire `scripts/seed-owner.ts`**

```ts
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

    console.log("Création des 8 catégories de dépenses par défaut...");
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
```

- [ ] **Step 2: Vérification manuelle**

Run: `npm run seed -- --company "L7ewate Test" --name "Hamoud" --phone "22998877" --code "5678"`
Expected: `✅ Terminé. ...`. Vérifier via `curl /api/auth/login` (Task 11) que la connexion avec `22998877`/`5678` fonctionne.

- [ ] **Step 3: Commit**

```bash
git add scripts/seed-owner.ts
git commit -m "scripts: seed-owner.ts écrit directement en Postgres (plus de Supabase Auth)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 22: `scripts/update-owner-credentials.ts` réécrit

**Files:**
- Modify: `scripts/update-owner-credentials.ts` (réécriture complète)

**Interfaces:**
- Consumes: `hashLoginCode` (Task 7), `isValidLoginCode`/`isValidMauritanianPhone` (Task 9).
- Produces (inchangé) : `npm run update-credentials -- --phone "..." --code "..."` — refuse s'il existe plusieurs comptes `owner`.

- [ ] **Step 1: Réécrire `scripts/update-owner-credentials.ts`**

```ts
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
```

- [ ] **Step 2: Vérification manuelle**

Run: `npm run update-credentials -- --phone "22998877" --code "9999"`
Expected: `✅ Terminé. ...`. Vérifier que la connexion avec l'ancien code `5678` échoue (`401`) et qu'avec `9999` elle réussit.

- [ ] **Step 3: Vérification — build + lint + tests complets**

Run: `npx tsc --noEmit && npm run lint && npm run test`
Expected: tout au vert. C'est le premier point du plan où plus aucun fichier ne référence `@supabase/supabase-js` en dehors de `lib/supabase/` lui-même (traité Task 23).

- [ ] **Step 4: Commit**

```bash
git add scripts/update-owner-credentials.ts
git commit -m "scripts: update-owner-credentials.ts écrit directement en Postgres

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 23: Nettoyage — retrait de `lib/supabase/` et de la dépendance

**Files:**
- Delete: `lib/supabase/client.ts`
- Delete: `lib/supabase/auth.ts`
- Delete: `lib/supabase/AuthProvider.tsx`
- Modify: `package.json`

**Interfaces:**
- Aucune — tâche de suppression pure, tout ce qui en dépendait a déjà basculé (Tasks 15, 17, 20, 21, 22).

- [ ] **Step 1: Vérifier qu'il ne reste aucune référence**

Run: `grep -rln "lib/supabase\|@supabase/supabase-js" --include="*.ts" --include="*.tsx" . --exclude-dir=node_modules`
Expected: uniquement les 3 fichiers de `lib/supabase/` eux-mêmes (aucun autre fichier applicatif ne doit apparaître — si un fichier apparaît, une Task précédente a été oubliée, la corriger avant de continuer).

- [ ] **Step 2: Supprimer le dossier**

```bash
git rm -r lib/supabase
```

- [ ] **Step 3: Retirer la dépendance**

Run: `npm uninstall @supabase/supabase-js`
Expected: `package.json`/`package-lock.json` mis à jour, plus de `@supabase/supabase-js` dans `node_modules`.

- [ ] **Step 4: Vérification — build complet**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: tout au vert, `npm run build` produit un build de production sans erreur.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "cleanup: retire lib/supabase/ et @supabase/supabase-js

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 24: Mise à jour de la documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/GETTING_STARTED.md`
- Modify: `docs/PROJECT_PLAN.md` (§2 tableau stack, §3 architecture, §6 auth, §11 env vars)
- Modify: `docs/ONBOARDING_COLLABORATEUR.md`

**Interfaces:** aucune (documentation uniquement). `docs/PROJECT_PHASES.md` n'est **pas** modifié (journal historique, voir Global Constraints).

- [ ] **Step 1: `README.md`**

Remplacer :
- Ligne 16 : `"100% hors-ligne" — ... synchronisation transparente vers PostgreSQL (Supabase)` → `synchronisation transparente vers PostgreSQL (self-hébergé)`
- Ligne 23 : `| Base de données | PostgreSQL (Supabase) |` → `| Base de données | PostgreSQL (self-hébergé, Docker) |`
- Ligne 24 : `| Stockage photos | Supabase Storage |` → `| Stockage photos | MinIO (S3-compatible, self-hébergé) |`
- Ligne 27 : `| Auth | Supabase Auth (email/mot de passe) |` → `| Auth | JWT maison (téléphone + code à 4 chiffres) |`
- Ligne 49 : `/supabase               → Client Supabase (auth, storage)` → `/auth                   → Auth JWT maison (session, client, provider)` (et ajouter une ligne `/postgres               → Accès Postgres serveur (pool, RLS, requêtes de synchro)` juste après `/powersync`)
- Lignes 78-80 : remplacer le bloc `NEXT_PUBLIC_SUPABASE_URL=`/`NEXT_PUBLIC_SUPABASE_ANON_KEY=`/`SUPABASE_SERVICE_ROLE_KEY=` par le contenu de `.env.example` (Task 1 Step 3)
- Ligne 85 : `(création du projet Supabase, PowerSync, ...)` → `(lancement de Postgres + MinIO, PowerSync, ...)`

- [ ] **Step 2: `docs/GETTING_STARTED.md`**

Remplacer la section "3. Créer le projet Supabase" (lignes 22-57) par :

```markdown
## 3. Lancer Postgres + MinIO

```bash
docker compose up -d
```

### Créer le rôle applicatif

Crée `db/app_role_setup.sql` (présent en local, jamais committé — il
contient un mot de passe) à partir de ce modèle :

```sql
create role app with login password 'CHOISIS_UN_MOT_DE_PASSE_FORT' noinherit;
grant usage on schema public to app;
grant select, insert, update, delete on all tables in schema public to app;
alter default privileges in schema public grant select, insert, update, delete on tables to app;
```

```bash
docker compose exec -T postgres psql -U postgres -d fbms < db/app_role_setup.sql
```

### Créer le rôle PowerSync

Ouvre `db/powersync_setup.sql` (présent en local, jamais committé). S'il
n'existe pas encore, recrée-le à partir de ce modèle :

```sql
create role powersync_role with replication bypassrls login password 'CHOISIS_UN_MOT_DE_PASSE_FORT';

grant select on all tables in schema public to powersync_role;
alter default privileges in schema public grant select on tables to powersync_role;

create publication powersync for all tables;
```

```bash
docker compose exec -T postgres psql -U postgres -d fbms < db/powersync_setup.sql
```

### Appliquer le schéma

```bash
npm run migrate
```

### Créer le bucket de stockage

```bash
npm run init-storage
```
```

Remplacer la section "Configurer l'instance PowerSync Cloud" (§4) pour dire que **Database Connections** pointe désormais vers le Postgres self-hébergé (host/port de la machine où tourne `docker compose`, utilisateur `powersync_role`) et que **Client Auth** doit être configuré en JWT HS256 avec le secret `JWT_SECRET` (au lieu de JWKS Supabase).

Mettre à jour le bloc `.env.local` (§5) avec le contenu de `.env.example` (Task 1).

- [ ] **Step 3: `docs/PROJECT_PLAN.md`**

§2 (tableau stack) : `| Database | PostgreSQL, hosted on Supabase |` → `| Database | PostgreSQL, self-hébergé (Docker, VPS) |` ; `| File/Photo storage | Supabase Storage (S3-compatible) |` → `| File/Photo storage | MinIO (S3-compatible, self-hébergé) |` ; `| Offline sync engine | PowerSync (client SQLite via WASM, syncs to Supabase Postgres) |` → `| Offline sync engine | PowerSync Cloud (client SQLite via WASM, syncs to self-hosted Postgres) |` ; `| Auth | Simple email/password login (Supabase Auth or custom ...) |` → `| Auth | JWT maison (téléphone + code à 4 chiffres, voir §6) |`.

§3 (architecture) : remplacer le schéma ASCII pour remplacer `[Supabase Postgres]` par `[Postgres self-hébergé]` et `[Supabase Storage]` par `[MinIO]`, et ajouter une ligne `API Next.js (/api/sync/write, /api/auth/*, /api/photos/*)` entre PowerSync Service et Postgres.

§6 (Auth Details) : remplacer par une description du JWT maison (téléphone+code, JWT HS256, refresh token en base, voir spec `docs/superpowers/specs/2026-08-10-supabase-to-postgres-migration-design.md`).

§11 (env vars) : remplacer par le contenu de `.env.example` (Task 1).

- [ ] **Step 4: `docs/ONBOARDING_COLLABORATEUR.md`**

Remplacer chaque mention de "projet Supabase" par "instance Postgres/MinIO du VPS", `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` par le contenu de `.env.example`, et `supabase/migrations/` par `db/migrations/`. Adapter l'avertissement sur la clé sensible (ligne 51) pour parler de `DATABASE_URL` (accès admin complet, contourne RLS).

- [ ] **Step 5: Commit**

```bash
git add README.md docs/GETTING_STARTED.md docs/PROJECT_PLAN.md docs/ONBOARDING_COLLABORATEUR.md
git commit -m "docs: documente l'architecture Postgres self-hébergé (remplace Supabase)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 25: Vérification de bout en bout et checklist de bascule VPS

**Files:** aucun (vérification uniquement).

**Interfaces:** aucune.

- [ ] **Step 1: Suite complète en local**

Run: `npx tsc --noEmit && npm run lint && npm run test && npm run build`
Expected: tout au vert.

- [ ] **Step 2: Parcours manuel complet (local, `npm run dev`)**

1. `npm run seed -- --company "..." --name "..." --phone "..." --code "1234"`
2. Se connecter dans l'app avec ce téléphone/code.
3. Créer un bateau, une sortie (trip), une dépense **avec photo**, en coupant le réseau (DevTools offline) pendant la saisie.
4. Rétablir le réseau : vérifier que la synchro PowerSync remonte les écritures (`status.connected` dans l'UI, vérifier en base `SELECT * FROM boats/trips/expenses`).
5. Vérifier que la photo apparaît dans MinIO (`{company_id}/{expense_id}.jpg`) et que `photo_local_status = 'uploaded'`.
6. Se déconnecter (`signOut`), recharger la page hors-ligne (DevTools offline avant reload) : l'app doit rediriger vers `/login` (comportement attendu, pas de session).
7. Se reconnecter, couper le réseau **après** connexion, recharger la page : l'app doit rester utilisable (session locale), le dashboard doit afficher les données déjà synchronisées.

Expected : chaque étape se comporte exactement comme avant la migration (aucune régression fonctionnelle visible).

- [ ] **Step 3: Checklist de bascule sur le VPS de production**

Documenter (dans le message de fin de tâche, pas besoin de fichier séparé) :
1. `git clone` du repo sur le VPS, `docker compose up -d`.
2. Exécuter `db/app_role_setup.sql` et `db/powersync_setup.sql` (mots de passe de prod, distincts du local).
3. `npm run migrate`, `npm run init-storage`.
4. Reconfigurer l'instance PowerSync Cloud : **Database Connections** → nouvelle source (IP/port du VPS, `powersync_role`), **Client Auth** → JWT HS256 avec le `JWT_SECRET` de production.
5. Déployer l'app avec les nouvelles variables d'environnement (`.env.production` ou équivalent selon l'hébergeur choisi pour l'app).
6. `npm run seed -- ...` pour créer le compte owner de production.
7. Refaire le parcours manuel du Step 2 en production.
8. Une fois confirmé stable : décommissionner le projet Supabase (spec §10).

- [ ] **Step 4: Commit final (si des ajustements ont eu lieu pendant la vérification)**

```bash
git status
# Si des fichiers ont été ajustés pendant la vérification manuelle :
git add -A
git commit -m "fix: ajustements de la vérification de bout en bout

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```
