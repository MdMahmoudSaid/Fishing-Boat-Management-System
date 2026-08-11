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
   vérification par clé publique/JWKS d'un fournisseur d'auth tiers). Note
   l'URL de l'instance (`NEXT_PUBLIC_POWERSYNC_URL`).

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

## 12. Déploiement (Vercel)

1. Connecte le repo à [Vercel](https://vercel.com).
2. Renseigne les mêmes variables d'environnement qu'en local (§5) dans
   **Project Settings → Environment Variables**.
3. Déploie — Vercel détecte Next.js automatiquement (`npm run build`).
4. Le service worker PWA (`public/sw.js`, généré par Serwist) rend l'app
   installable et utilisable hors-ligne une fois le premier chargement fait
   en ligne.
