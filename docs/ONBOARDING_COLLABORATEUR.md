# Rejoindre le projet en tant que développeur (sans créer de nouveau backend)

Ce guide est pour un·e développeur·se qui clone le repo pour **travailler sur
le code**, en se connectant au **même** projet Supabase et à la **même**
instance PowerSync que le reste de l'équipe — donc **sans** créer de nouveau
projet Supabase, de nouvelle instance PowerSync, ni rejouer les migrations.

Pour créer un environnement entièrement séparé (nouvelle base, nouvelles
données), voir plutôt [`GETTING_STARTED.md`](GETTING_STARTED.md).

## 1. Prérequis

- Node.js 20+ et npm
- Git
- Aucun compte Supabase / PowerSync à créer — tu utilises ceux du projet existant

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

Il doit contenir ces 5 variables (copiées telles quelles depuis le projet
existant — ne rien régénérer) :

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_POWERSYNC_URL=
POWERSYNC_TOKEN_SECRET=
```

> ⚠️ **`SUPABASE_SERVICE_ROLE_KEY` est une clé sensible** : elle contourne
> toutes les règles de sécurité (RLS) et donne un accès total à la base. Elle
> n'est utilisée que par les scripts `npm run seed` et
> `npm run update-credentials` (voir `scripts/`) — pas par l'app elle-même en
> dev normal. Si le collaborateur n'a pas besoin de lancer ces scripts, le
> propriétaire du projet peut la laisser vide dans le fichier transmis.

## 4. Lancer l'app

```bash
npm run dev
```

L'app se connecte directement à la base Supabase et à l'instance PowerSync
existantes — même schéma, mêmes données, même utilisateurs. **Aucune
migration à exécuter, aucun bucket de stockage à créer, aucune règle
PowerSync à configurer.**

## 5. Se connecter

Utilise un compte existant (numéro de téléphone mauritanien + code à 4
chiffres) fourni par le propriétaire du projet, ou crée-en un via
`npm run seed` / `npm run update-credentials` si tu as reçu la clé service
role.

## ⚠️ Points d'attention (environnement partagé)

- **Données réelles partagées** : toute création/modification/suppression
  dans l'app (bateaux, sorties, ventes...) affecte les **mêmes données** que
  tout le monde — ce n'est pas un bac à sable isolé. Coordonne-toi avant de
  tester des suppressions ou des changements en masse.
- **Migrations SQL** : si le travail nécessite un changement de schéma
  (nouvelle table/colonne), ajoute un fichier dans `supabase/migrations/`
  mais **ne l'exécute pas toi-même** sur le projet Supabase partagé sans
  coordination — une migration mal calibrée impacte tout le monde en
  production/dev partagé.
- **Ne commite jamais `.env.local`** ni aucune clé qu'il contient.
- **Branches** : travaille sur une branche dédiée (`git checkout -b
  ma-feature`), ne push jamais directement sur `main`.
