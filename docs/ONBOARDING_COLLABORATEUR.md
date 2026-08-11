# Rejoindre le projet en tant que développeur (sans créer de nouveau backend)

Ce guide est pour un·e développeur·se qui clone le repo pour **travailler sur
le code**, en se connectant à la **même** instance Postgres/MinIO du VPS et à
la **même** instance PowerSync que le reste de l'équipe — donc **sans**
lancer de nouvelle stack Docker locale, de nouvelle instance PowerSync, ni
rejouer les migrations.

Pour créer un environnement entièrement séparé (nouvelle base, nouvelles
données), voir plutôt [`GETTING_STARTED.md`](GETTING_STARTED.md).

## 1. Prérequis

- Node.js 20+ et npm
- Git
- Aucune stack Docker locale ni compte PowerSync à créer — tu utilises ceux du projet existant

## 2. Cloner le repo

```bash
git clone <url-du-repo>
cd Fishing-Boat-Management-System
npm install
```

## 3. Récupérer le fichier `.env.local`

`.env.local` n'est **jamais commité** (il est dans `.gitignore`) — il n'existe
donc pas après un `git clone`. Il faut que le propriétaire du projet te
l'envoie directement, **par un canal privé** (message direct, gestionnaire de
mots de passe partagé, etc.) — jamais par un canal public (issue GitHub, PR,
Slack public, email non chiffré...).

Place le fichier reçu à la racine du projet :

```bash
# à la racine du repo
Fishing-Boat-Management-System/.env.local
```

Il doit contenir ces variables (copiées telles quelles depuis l'instance
Postgres/MinIO du VPS existante — ne rien régénérer) :

```
DATABASE_URL=
APP_DATABASE_URL=
JWT_SECRET=
MINIO_ENDPOINT=
MINIO_PORT=
MINIO_ACCESS_KEY=
MINIO_SECRET_KEY=
MINIO_BUCKET=
MINIO_USE_SSL=
NEXT_PUBLIC_POWERSYNC_URL=
```

> ⚠️ **`DATABASE_URL` est une chaîne de connexion sensible** : elle donne un
> accès admin complet à la base (contourne les policies RLS). Elle n'est
> utilisée que par les scripts `npm run migrate`, `npm run seed` et
> `npm run update-credentials` (voir `scripts/`) — pas par l'app elle-même en
> dev normal (qui passe par `APP_DATABASE_URL`, restreinte par RLS, via
> `/api/sync/write`). Si le collaborateur n'a pas besoin de lancer ces
> scripts, le propriétaire du projet peut la laisser vide dans le fichier
> transmis.

## 4. Lancer l'app

```bash
npm run dev
```

L'app se connecte directement à la base Postgres et à l'instance PowerSync
existantes du VPS — même schéma, mêmes données, même utilisateurs. **Aucune
migration à exécuter, aucun bucket de stockage à créer, aucune règle
PowerSync à configurer.**

## 5. Se connecter

Utilise un compte existant (numéro de téléphone mauritanien + code à 4
chiffres) fourni par le propriétaire du projet, ou crée-en un via
`npm run seed` / `npm run update-credentials` si tu as reçu `DATABASE_URL`.

## ⚠️ Points d'attention (environnement partagé)

- **Données réelles partagées** : toute création/modification/suppression
  dans l'app (bateaux, sorties, ventes...) affecte les **mêmes données** que
  tout le monde — ce n'est pas un bac à sable isolé. Coordonne-toi avant de
  tester des suppressions ou des changements en masse.
- **Migrations SQL** : si le travail nécessite un changement de schéma
  (nouvelle table/colonne), ajoute un fichier dans `db/migrations/` mais **ne
  l'exécute pas toi-même** (`npm run migrate`) sur l'instance Postgres
  partagée du VPS sans coordination — une migration mal calibrée impacte
  tout le monde en production/dev partagé.
- **Ne commite jamais `.env.local`** ni aucune clé qu'il contient.
- **Branches** : travaille sur une branche dédiée (`git checkout -b
  ma-feature`), ne push jamais directement sur `main`.
