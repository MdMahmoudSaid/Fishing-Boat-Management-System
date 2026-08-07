# Guide de démarrage

Étapes pour installer, configurer et lancer l'application de zéro, plus les
opérations courantes (créer une société, changer les identifiants de
connexion). Pour le modèle de données et les règles métier, voir
[`PROJECT_PLAN.md`](PROJECT_PLAN.md).

## 1. Prérequis

- Node.js 20+ et npm
- Un compte [Supabase](https://supabase.com) (base de données + auth + stockage)
- Un compte [PowerSync Cloud](https://powersync.com) (synchronisation hors-ligne)

## 2. Installer les dépendances

```bash
git clone <url-du-repo>
cd Fishing-Boat-Management-System
npm install
```

## 3. Créer le projet Supabase

1. Crée un nouveau projet sur [supabase.com](https://supabase.com/dashboard).
2. Dans **Project Settings → API**, note :
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key (secrète, ne jamais l'exposer côté client) → `SUPABASE_SERVICE_ROLE_KEY`

### Appliquer le schéma

Dans **SQL Editor**, exécute le contenu de chaque fichier de
`supabase/migrations/`, **dans l'ordre du nom de fichier** (l'horodatage
au début garantit le bon ordre) :

1. `20260804000000_init_schema.sql` — tables (companies, users, boats, trips, ...)
2. `20260804000001_rls_policies.sql` — sécurité (Row Level Security, isolation par société)
3. `20260805000000_expense_photos_storage.sql` — bucket de stockage pour les photos de reçus
4. `20260805000001_sales_total_amount_plain_column.sql` — ajustement de colonne

### Configurer le rôle PowerSync

Ouvre `supabase/powersync_setup.sql` (présent en local, jamais committé — il
contient un mot de passe). Si le fichier n'existe pas encore, recrée-le à
partir de ce modèle :

```sql
create role powersync_role with replication bypassrls login password 'CHOISIS_UN_MOT_DE_PASSE_FORT';

grant select on all tables in schema public to powersync_role;
alter default privileges in schema public grant select on tables to powersync_role;

create publication powersync for all tables;
```

Exécute-le une fois dans le SQL Editor. **Garde le mot de passe choisi** —
il sera redemandé à l'étape suivante.

## 4. Créer l'instance PowerSync Cloud

1. Sur [powersync.com](https://www.powersync.com), crée une instance.
2. **Database Connections → Connect to Source Database** : renseigne les
   informations de connexion Postgres de ton projet Supabase (host, port,
   database, utilisateur `powersync_role`, mot de passe choisi à l'étape 3).
3. **Sync Rules** : colle le contenu de `powersync/sync-rules.yaml` (déjà
   dans le repo).
4. **Client Auth** : configure PowerSync pour accepter les JWT émis par
   Supabase Auth (clé publique / JWKS du projet Supabase — voir la doc
   PowerSync "Supabase Auth integration"). Note l'URL de l'instance
   (`NEXT_PUBLIC_POWERSYNC_URL`) et le secret associé
   (`POWERSYNC_TOKEN_SECRET`).

## 5. Variables d'environnement

```bash
cp .env.example .env.local
```

Remplis `.env.local` avec les valeurs récupérées aux étapes 3-4 :

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_POWERSYNC_URL=
POWERSYNC_TOKEN_SECRET=
```

## 6. Lancer l'app en développement

```bash
npm run dev
```

Ouvre [http://localhost:3000](http://localhost:3000). À ce stade, la page
de connexion s'affiche mais aucun compte n'existe encore.

## 7. Créer une société (compte propriétaire)

Il n'y a pas d'écran d'inscription dans l'app — la toute première société et
son compte propriétaire se créent via un script, avec la clé
`service_role` :

```bash
npm run seed -- --company "Nom de la société" --name "Nom du propriétaire" --phone "XXXXXXXX" --code "XXXX"
```

- `--phone` : numéro mauritanien à 8 chiffres, doit commencer par **2**
  (Chinguitel), **3** (Mattel) ou **4** (Mauritel).
- `--code` : exactement 4 chiffres — c'est ce qui sera saisi pour se
  connecter (pas un mot de passe classique, voir §6 du
  [PROJECT_PLAN](PROJECT_PLAN.md) et `lib/auth/phoneAuth.ts` pour le détail
  technique).

Exemple :

```bash
npm run seed -- --company "L7ewate" --name "Hamoud" --phone "33112233" --code "5678"
```

Le script crée : le compte de connexion (Supabase Auth), la société, les 8
catégories de dépenses par défaut, et les réglages par défaut (méthode de
paiement équipage, langue arabe par défaut).

## 8. Se connecter

Dans l'app, sur l'écran de connexion :
- **Numéro de téléphone** : les 8 chiffres saisis à `--phone` (le `+222` est
  déjà affiché fixe devant le champ)
- **Code** : les 4 chiffres saisis à `--code`

## 9. Créer une société supplémentaire

Relance simplement la même commande qu'à l'étape 7 avec un **numéro de
téléphone différent** — chaque exécution crée une société entièrement
indépendante et isolée (aucune donnée partagée entre sociétés, garanti par
les policies RLS) :

```bash
npm run seed -- --company "Autre société" --name "Autre propriétaire" --phone "22998877" --code "4321"
```

## 10. Changer le téléphone/code d'un compte existant

Si tu veux changer les identifiants d'un compte propriétaire déjà créé,
sans repasser par le dashboard Supabase :

```bash
npm run update-credentials -- --phone "XXXXXXXX" --code "XXXX"
```

⚠️ Ce script suppose une seule société "owner" par exécution — si plusieurs
sociétés existent, adapte `scripts/update-owner-credentials.ts` pour cibler
la bonne (actuellement il refuse de s'exécuter s'il trouve plus d'un
compte `owner` au total).

## 11. Vérifications avant de committer

```bash
npm run test    # tests unitaires (Vitest)
npm run lint    # ESLint
npm run build   # build de production + vérification TypeScript
```

## 12. Déploiement (Vercel)

1. Connecte le repo à [Vercel](https://vercel.com).
2. Renseigne les mêmes variables d'environnement qu'en local (§5) dans
   **Project Settings → Environment Variables**.
3. Déploie — Vercel détecte Next.js automatiquement (`npm run build`).
4. Le service worker PWA (`public/sw.js`, généré par Serwist) rend l'app
   installable et utilisable hors-ligne une fois le premier chargement fait
   en ligne.
