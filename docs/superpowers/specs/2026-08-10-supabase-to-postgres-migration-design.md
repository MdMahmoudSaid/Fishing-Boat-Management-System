# Migration Supabase → PostgreSQL self-hébergé

**Date** : 2026-08-10
**Statut** : approuvé (en attente de plan d'implémentation)

## 1. Contexte et objectif

Le client craint qu'un abonnement Supabase payant devienne nécessaire dans le
futur (limites du plan gratuit) et demande de retirer la dépendance à
Supabase. Il possède déjà un VPS (utilisé aujourd'hui pour déployer l'app une
fois terminée).

Décision de périmètre (validée avec l'utilisateur) : **remplacement complet**
de Supabase — pas seulement l'hébergement Postgres, mais aussi Auth, Storage,
et l'API PostgREST qu'utilise PowerSync pour pousser les écritures locales.
Option alternative envisagée et écartée : auto-héberger la stack Supabase
officielle (Postgres + PostgREST + GoTrue + Storage en Docker) — aurait
minimisé les changements de code applicatif, mais l'utilisateur préfère un
remplacement 100 % custom, sans aucune brique Supabase même auto-hébergée.

**Contrainte principale** : le comportement observable de l'app ne doit pas
changer. Même écran de connexion (téléphone + code à 4 chiffres), même
fonctionnement hors-ligne (PowerSync inchangé en tant que service), mêmes
règles métier, mêmes performances perçues.

**Hors périmètre** :
- PowerSync reste sur PowerSync Cloud (ce n'est pas Supabase, pas la demande
  du client) — seule sa configuration de connexion change (nouvelle source
  Postgres, nouvelle méthode de vérification JWT).
- L'hébergement de l'app Next.js elle-même (Vercel aujourd'hui, VPS plus
  tard) n'est pas traité par ce changement.
- Aucune migration de données réelles n'est nécessaire : seules des données
  de test existent aujourd'hui côté Supabase (confirmé avec l'utilisateur).

## 2. Architecture cible

```
[Next.js PWA]
   |
   |-- reads/writes --> [PowerSync Client SQLite (local, in-browser)]
   |                         |
   |                         |-- sync down --> [PowerSync Cloud] --> [Postgres self-hébergé (VPS / Docker local)]
   |                         |-- sync up   --> [PowerSync Cloud] --> BackendConnector.uploadData()
   |                                                                     |
   |                                                                     v
   |                                                     [POST /api/sync/write (Next.js API)]
   |                                                                     |
   |                                                                     v
   |                                                          [Postgres self-hébergé, via `pg`]
   |
   |-- login --> [POST /api/auth/login] --> vérifie phone+code_hash (bcrypt) --> émet JWT (HS256)
   |
   |-- photo upload (queue offline) --> [POST /api/photos/upload] --> [MinIO (S3-compatible, VPS)]
```

Composants Docker (identiques en local et sur le VPS, via `.env` différents) :
- `postgres` (image officielle `postgres:16`, `wal_level=logical` — requis
  par PowerSync pour la réplication logique)
- `minio` (stockage objet S3-compatible pour les photos)

## 3. Base de données

- Le schéma métier (`companies`, `boats`, `trips`, etc.) ne change pas.
- `public.users` devient une table autonome :
  - `id references auth.users(id)` supprimé (cette table Supabase n'existera
    plus)
  - `phone text not null unique` remplace `email` comme identifiant de
    connexion
  - `code_hash text not null` (bcrypt du code à 4 chiffres) remplace
    `password_hash`
- Migration `20260805000000_expense_photos_storage.sql` (bucket Supabase
  Storage) supprimée — la création du bucket MinIO se fait via un script
  d'init séparé (`scripts/init-minio.ts` ou équivalent docker-entrypoint).
- RLS conservée en défense en profondeur (le schéma dénormalise déjà
  `company_id` sur chaque table dans ce but précis) :
  - `private.user_company_id()` (qui lisait `auth.uid()`) réécrite pour lire
    `current_setting('app.company_id', true)::uuid`
  - `/api/sync/write` positionne cette variable de session
    (`SET LOCAL app.company_id = $1`) au début de chaque transaction, après
    avoir vérifié le JWT
  - Le rôle applicatif utilisé par l'API (connexion `pg`) doit donc être
    `authenticated`-équivalent (RLS appliquée), pas superuser/bypassrls —
    seul le rôle PowerSync (réplication descendante) garde `bypassrls`,
    comme aujourd'hui.

## 4. Authentification

Remplace intégralement Supabase Auth. Comportement utilisateur final
**inchangé** : téléphone mauritanien (8 chiffres) + code à 4 chiffres.

- Simplification permise par le changement de fournisseur : l'email
  synthétique (`{phone}@fbms.local`) et le mot de passe dérivé
  (`fbms-{phone}-{code}`) étaient un contournement des contraintes de
  Supabase Auth (email + mot de passe ≥ 6 caractères). Notre propre backend
  n'a pas cette contrainte — on authentifie directement par
  `phone` + `code_hash` (bcrypt). `lib/auth/phoneAuth.ts` perd
  `toSyntheticEmail`/`deriveLoginPassword`, garde les validateurs
  (`isValidMauritanianPhone`, `isValidLoginCode`).
- Nouvelles routes API :
  - `POST /api/auth/login` — `{phone, code}` → vérifie contre `code_hash`
    (bcrypt.compare) → émet `{accessToken, refreshToken, user}`
  - `POST /api/auth/refresh` — `{refreshToken}` → nouveau `accessToken`
  - `POST /api/auth/logout` — invalide le refresh token (table
    `refresh_tokens` ou JWT stateless avec liste de révocation courte —
    détail à trancher en phase de plan)
- JWT HS256 signé avec `JWT_SECRET` (remplace `POWERSYNC_TOKEN_SECRET`,
  même rôle : PowerSync doit être configuré pour vérifier ces JWT avec ce
  même secret). Claims : `sub` (user id), `company_id`, `role`, `exp`.
- `AuthProvider` (actuellement `lib/supabase/AuthProvider.tsx`, dépend de
  `@supabase/supabase-js`) réécrit en `lib/auth/AuthProvider.tsx` : lit/écrit
  la session dans `localStorage`, refresh silencieux quand `navigator.onLine`
  redevient vrai. Interface `useSession()` gardée aussi proche que possible
  de l'existante (`{session, loading}`) pour minimiser les changements dans
  les composants consommateurs (`useCompanyId.ts` et autres).
- Access token courte durée (ex: 1h), refresh token longue durée (ex: 90
  jours) — permet à l'app de rester utilisable hors-ligne longtemps après le
  dernier login, comme aujourd'hui avec Supabase (`persistSession`).

## 5. Écritures PowerSync → Postgres

`lib/powersync/BackendConnector.ts` utilise aujourd'hui
`supabase.from(table).upsert()/.update()/.delete()` (API PostgREST générée
par Supabase). Sans Supabase, il n'y a pas d'équivalent générique tout fait.

- Nouvelle route `POST /api/sync/write`, appelée avec le JWT de session :
  - reçoit `{table, op: 'PUT'|'PATCH'|'DELETE', id, data}`
  - vérifie le JWT, extrait `company_id`
  - vérifie que `data.company_id` (ou la ligne existante pour
    update/delete) correspond au `company_id` du token — refus sinon
  - allowlist de tables autorisées (les 13 tables métier, pas
    `companies`/`users` en écriture directe côté client — cohérent avec les
    policies RLS actuelles qui n'exposent pas d'INSERT sur ces tables)
  - exécute la requête SQL paramétrée via `pg` (upsert = `INSERT ... ON
    CONFLICT (id) DO UPDATE`, update = `UPDATE ... WHERE id = $1`, delete =
    `DELETE ... WHERE id = $1`), dans une transaction avec
    `SET LOCAL app.company_id`
  - retourne les codes d'erreur Postgres tels quels (23505, 23503, 23514,
    23502, 22P02, 42501, 42703, 42P01) pour que la logique existante de
    `NON_RETRYABLE_POSTGRES_ERROR_CODES` dans `BackendConnector.ts`
    continue de fonctionner sans changement
- `fetchCredentials()` : remplace `supabase.auth.getSession()` par la
  lecture du JWT stocké localement (via le nouvel `AuthProvider`/authClient).

## 6. Photos (remplace Supabase Storage)

- MinIO auto-hébergé sur le VPS (et en local via Docker), bucket privé
  `expense-photos`, même convention de chemin
  (`{company_id}/{expense_id}.jpg`).
- Le navigateur ne parle jamais directement à MinIO (pas de clés
  exposées) :
  - `POST /api/photos/upload` — reçoit le blob + JWT, vérifie
    `company_id`, écrit dans MinIO via le SDK serveur
  - `GET /api/photos/[...path]` — sert/proxy la photo après vérification
    JWT + `company_id`
- `lib/sync/photoUploadQueue.ts` : remplace l'appel
  `supabase.storage.from(BUCKET).upload()` par un `fetch('/api/photos/upload', ...)`.
  Comportement observable inchangé : file d'attente IndexedDB, statuts
  `pending_upload`/`uploaded`/`failed`, retry avec backoff exponentiel
  plafonné à 60s.

## 7. PowerSync (reconfiguration, pas de changement de service)

- **Database Connections** : pointer vers le nouveau Postgres (VPS ou
  Docker local), avec un rôle `powersync_role` identique à aujourd'hui
  (`replication`, `bypassrls`, `login`) — la doc §4 de
  `GETTING_STARTED.md` reste valable, juste la cible change.
- **Client Auth** : reconfigurer pour vérifier les JWT HS256 émis par notre
  propre `/api/auth/login` (secret partagé `JWT_SECRET`) au lieu des JWT
  Supabase (JWKS).
- **Sync Rules** (`powersync/sync-rules.yaml`) : inchangées, elles ne
  référencent aucune spécificité Supabase.

## 8. Scripts

- `scripts/seed-owner.ts` et `scripts/update-owner-credentials.ts` :
  remplacent `supabase.auth.admin.createUser`/requêtes `.from()` par des
  requêtes directes via `pg` (connexion admin locale), hashent le code avec
  bcrypt avant insertion.

## 9. Infrastructure / environnement

- Nouveau `docker-compose.yml` à la racine : services `postgres` et
  `minio`, utilisé aussi bien en local (`npm run dev`) que sur le VPS —
  seules les valeurs de `.env` diffèrent (mots de passe, volumes,
  exposition réseau).
- `.env.example` mis à jour :
  ```
  DATABASE_URL=
  JWT_SECRET=
  MINIO_ENDPOINT=
  MINIO_PORT=
  MINIO_ACCESS_KEY=
  MINIO_SECRET_KEY=
  MINIO_BUCKET=expense-photos
  MINIO_USE_SSL=
  NEXT_PUBLIC_POWERSYNC_URL=
  ```
  (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`, `POWERSYNC_TOKEN_SECRET` retirés/renommés)
- `package.json` : retire `@supabase/supabase-js`, ajoute `pg`, `bcryptjs`,
  `jose` (JWT), `minio` (client S3).
- Docs à mettre à jour : `GETTING_STARTED.md` (remplace la section
  "Créer le projet Supabase" par "Lancer Postgres + MinIO en local/VPS"),
  `PROJECT_PLAN.md` (tableau stack §2 et §3 architecture),
  `docs/ONBOARDING_COLLABORATEUR.md` si elle mentionne Supabase.

## 10. Bascule (cutover)

Pas de migration de données réelles nécessaire (données de test
uniquement). Bascule en une fois, pas de dual-write :
1. Développer et valider entièrement en local (Docker Compose : postgres +
   minio), avec `npm run test`, `npm run lint`, `npm run build` au vert.
2. Vérification manuelle du parcours complet : login, création
   société/trip/dépense+photo hors-ligne, retour en ligne, vérification
   que la synchro PowerSync (montée et descente) fonctionne, que la photo
   apparaît dans MinIO liée à la bonne dépense.
3. Provisionner Postgres + MinIO sur le VPS, reconfigurer l'instance
   PowerSync Cloud (source DB + client auth), déployer les nouvelles
   variables d'environnement, re-seed un compte owner de test avec
   `npm run seed`.
4. Décommissionner le projet Supabase une fois la bascule confirmée stable.

## 11. Points laissés à la phase de plan d'implémentation

- Mécanisme exact de révocation des refresh tokens (table dédiée vs JWT
  stateless court-circuité par expiration courte).
- Détail des tests à ajouter/adapter (auth JWT, route `/api/sync/write`,
  upload/download photos).
- Ordre précis des étapes de code (quels fichiers dans quel commit) —
  objet du plan d'implémentation à venir via la skill `writing-plans`.
