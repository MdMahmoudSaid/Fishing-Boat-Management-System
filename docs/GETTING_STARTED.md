# Guide de démarrage

Étapes pour installer, configurer et lancer l'application de zéro, plus les
opérations courantes (créer une société, changer les identifiants de
connexion). Pour le modèle de données et les règles métier, voir
[`PROJECT_PLAN.md`](PROJECT_PLAN.md).

## 1. Prérequis

- Node.js 20+ et npm
- Docker (Postgres + MinIO tournent en conteneurs, en local comme sur le VPS)
- Un compte [PowerSync Cloud](https://powersync.com) (synchronisation hors-ligne)

## 2. Installer les dépendances

```bash
git clone <url-du-repo>
cd Fishing-Boat-Management-System
npm install
```

## 3. Lancer Postgres + MinIO

```bash
docker compose up -d
```

Le `docker-compose.yml` à la racine expose Postgres sur `localhost:55432`
(et non `5432`) — remap volontaire pour éviter un conflit avec un autre
conteneur Postgres tournant en local sur cette machine ; adapte le port
dans `docker-compose.yml` et dans `.env.local` (§5) si `5432` est libre
chez toi. MinIO expose l'API S3 sur `9000` et la console web sur `9001`.

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

**Garde les deux mots de passe choisis** — celui de `app` va dans
`APP_DATABASE_URL` (§5), celui de `powersync_role` sera redemandé à
l'étape suivante.

### Appliquer le schéma

```bash
npm run migrate
```

Applique dans l'ordre chaque fichier de `db/migrations/` (tables métier,
policies RLS, ajustements de colonnes, table `refresh_tokens`).

### Créer le bucket de stockage

```bash
npm run init-storage
```

Crée le bucket MinIO `expense-photos` (photos de reçus de dépenses).

## 4. Créer l'instance PowerSync Cloud

1. Sur [powersync.com](https://www.powersync.com), crée une instance.
2. **Database Connections → Connect to Source Database** : renseigne les
   informations de connexion du Postgres self-hébergé (host/port de la
   machine où tourne `docker compose` — `localhost:55432` en local,
   inaccessible depuis PowerSync Cloud sans tunnel/exposition réseau ; sur
   le VPS, l'adresse publique du serveur), database `fbms`, utilisateur
   `powersync_role`, mot de passe choisi à l'étape 3.
3. **Sync Rules** : colle le contenu de `powersync/sync-rules.yaml` (déjà
   dans le repo).
4. **Client Auth** : configure PowerSync en JWT HS256, avec le même secret
   que `JWT_SECRET` (émis par notre propre `POST /api/auth/login` — plus de
   vérification par clé publique/JWKS d'un fournisseur d'auth tiers).
   Renseigne aussi `client_auth.jwks.keys[].kid` avec exactement
   `fbms-hs256` (constante `KEY_ID` dans `lib/auth/jwt.ts`) et
   `client_auth.audience` avec la valeur de `POWERSYNC_JWT_AUDIENCE`
   (`.env.example`, ex. `powersync-dev` en local) — PowerSync rejette tout
   token dont le `kid`/`aud` ne correspond pas à cette config. Note l'URL de
   l'instance (`NEXT_PUBLIC_POWERSYNC_URL`).

## 5. Variables d'environnement

```bash
cp .env.example .env.local
```

Remplis `.env.local` avec les valeurs des étapes 3-4 :

```
DATABASE_URL=postgres://postgres:postgres@localhost:55432/fbms
APP_DATABASE_URL=postgres://app:CHANGE_ME@localhost:55432/fbms
JWT_SECRET=
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=expense-photos
MINIO_USE_SSL=false
NEXT_PUBLIC_POWERSYNC_URL=
```

## 6. Lancer l'app en développement

```bash
npm run dev
```

Ouvre [http://localhost:3000](http://localhost:3000). À ce stade, la page
de connexion s'affiche mais aucun compte n'existe encore.

## 7. Créer une société (compte propriétaire)

Il n'y a pas d'écran d'inscription dans l'app — la toute première société et
son compte propriétaire se créent via un script, avec la connexion Postgres
admin (`DATABASE_URL`) :

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

Le script crée : le compte de connexion (`phone` + `code_hash` bcrypt dans
`public.users`), la société, les 8 catégories de dépenses par défaut, et
les réglages par défaut (méthode de paiement équipage, langue arabe par
défaut).

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
sans passer par une requête SQL manuelle :

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

## 12. Déploiement (VPS)

L'app, Postgres, MinIO et un reverse proxy (Caddy, HTTPS automatique)
tournent tous dans le même `docker-compose.yml`, sur le VPS. Cette section
part d'un VPS vierge (Docker déjà installé) et suppose qu'un nom de domaine
pointe déjà vers son IP.

### 1. Cloner et créer les rôles Postgres

```bash
git clone <url-du-repo>
cd Fishing-Boat-Management-System
docker compose up -d postgres minio
```

Recrée `db/app_role_setup.sql` et `db/powersync_setup.sql` avec des **mots
de passe de production, différents de ceux utilisés en local** (§3), puis
exécute-les comme en local :

```bash
docker compose exec -T postgres psql -U postgres -d fbms < db/app_role_setup.sql
docker compose exec -T postgres psql -U postgres -d fbms < db/powersync_setup.sql
```

### 2. Créer et remplir `.env.production`

```bash
cp .env.production.example .env.production
```

Remplis chaque valeur `CHANGE_ME_*` — voir les commentaires dans le fichier
pour ce que chaque variable doit contenir et avec quoi elle doit rester
cohérente (ex. `DATABASE_URL` et `POSTGRES_PASSWORD` doivent utiliser le
même mot de passe). Génère `JWT_SECRET` avec `openssl rand -hex 32`.

`DOMAIN` doit être le nom de domaine qui pointe vers l'IP du VPS — Caddy
obtient automatiquement un certificat HTTPS pour ce domaine au démarrage.

### 3. Reconfigurer PowerSync Cloud pour ce VPS

Reprends l'étape §4 en pointant **Database Connections** vers l'adresse
publique du VPS (pas `localhost`), et en renseignant dans **Client Auth**
la valeur `POWERSYNC_JWT_AUDIENCE` que tu as choisie pour la production dans
`.env.production`. Note l'URL de l'instance dans
`NEXT_PUBLIC_POWERSYNC_URL` de `.env.production`.

### 4. Construire et lancer toute la stack

```bash
docker compose --env-file .env.production up -d --build
```

Ceci construit l'image de l'app (`Dockerfile`, build standalone — voir
`next.config.mjs`) et démarre les 4 services (`postgres`, `minio`, `app`,
`caddy`). Premier accès HTTPS un peu plus lent le temps que Caddy obtienne
le certificat.

### 5. Appliquer le schéma, créer le bucket, créer le compte owner

Ces trois commandes tournent sur l'hôte (pas dans un conteneur), donc elles
ont besoin d'un `.env.local` pointant vers Postgres/MinIO via leurs ports
**publiés sur l'hôte** (pas les noms de service Docker internes utilisés par
le conteneur `app`) :

```bash
cp .env.production .env.local
# puis édite .env.local : remplace `postgres` par `localhost:55432` (ou le
# port choisi pour Postgres) et `minio` par `localhost` dans DATABASE_URL/
# APP_DATABASE_URL/MINIO_ENDPOINT, comme en local (§5).
npm install
npm run migrate
npm run init-storage
npm run seed -- --company "..." --name "..." --phone "..." --code "...."
```

### 6. Vérifier

Ouvre `https://<DOMAIN>`, connecte-toi avec le compte créé à l'étape 5,
refais le parcours de test (créer un bateau/une sortie/une dépense avec
photo, couper/rétablir le réseau) pour confirmer que la synchro PowerSync
et l'upload photo fonctionnent bout en bout en production.

### 7. Mettre à jour l'app après un nouveau commit

```bash
git pull
docker compose --env-file .env.production up -d --build app
```
