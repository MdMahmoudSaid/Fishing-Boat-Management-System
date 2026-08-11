# 🎣 Fishing Boat Management System

Système de gestion complet pour une entreprise de pêche — application mobile-first, offline-first (PWA) pour gérer le cycle de vie complet des sorties de pêche : bateaux, sorties, dépenses, captures, inventaire, ventes, acheteurs, paiements d'équipage et rapports de profit.

## 🚀 Fonctionnalités principales

- **Gestion des bateaux** — CRUD, statut (actif, maintenance, en sortie), agrégats de revenus/dépenses/profits par bateau
- **Gestion des sorties de pêche** — création, affectation bateau + équipage, transitions de statut (Préparation → En mer → Retourné → Clôturé)
- **Dépenses** — catégories, photos de reçus avec file d'attente de téléversement hors-ligne
- **Captures** — enregistrement par catégorie de poisson, qualité, quantité, unité
- **Inventaire** — dérivé des captures − ventes, par sortie et agrégé
- **Ventes** — validation contre le stock restant, acheteurs, paiements partiels/ultérieurs
- **Calcul de profit** — revenus bruts, dépenses totales, paiements d'équipage, profit net en temps réel
- **Tableau de bord** — cartes agrégées (bateaux, sorties, revenus, dépenses, profit net, dettes clients)
- **Rapports** — Rapport Bateau, Rapport Sortie, Rapport Dépenses, Rapport Ventes, Rapport Dettes Clients
- **100% hors-ligne** — toutes les lectures/écritures passent par SQLite local (PowerSync), synchronisation transparente vers PostgreSQL (self-hébergé)

## 🛠️ Stack technique

| Couche | Technologie |
|---|---|
| Framework | Next.js (App Router, TypeScript) |
| Base de données | PostgreSQL (self-hébergé, Docker) |
| Stockage photos | MinIO (S3-compatible, self-hébergé) |
| Sync hors-ligne | PowerSync (SQLite local → Postgres) |
| Hébergement | Vercel |
| Auth | JWT maison (téléphone + code à 4 chiffres) |
| Styling | Tailwind CSS |
| PWA | next-pwa (installable, offline app shell) |
| Langue | Arabe (RTL) — structure i18n extensible |

## 📁 Structure du projet

```
/app                      → Pages Next.js (App Router)
  /(auth)/login
  /(app)/dashboard
  /(app)/boats
  /(app)/trips
  /(app)/trips/[id]
  /(app)/expenses
  /(app)/sales
  /(app)/buyers
  /(app)/crew
  /(app)/reports
  /(app)/settings
/lib
  /powersync              → Configuration client PowerSync, schéma
  /postgres               → Accès Postgres serveur (pool, RLS, requêtes de synchro)
  /auth                   → Auth JWT maison (session, client, provider)
  /db                     → Helpers de requêtes SQLite locales
  /sync                   → Logique de file d'attente de téléversement photos
  /calculations           → Fonctions de calcul (profit, inventaire, équipage)
  /i18n                   → Dictionnaire de traductions (ar.json)
/components
  /ui                     → Composants partagés (boutons, cartes, inputs)
  /forms                  → Formulaires par entité
/public
  manifest.json, icons, service worker
```

## 🚦 Pour commencer

```bash
# Installer les dépendances
npm install

# Configurer les variables d'environnement
cp .env.example .env.local
# Remplir les valeurs dans .env.local

# Lancer le serveur de développement
npm run dev
```

### Variables d'environnement requises

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

> 📖 Guide détaillé étape par étape (lancement de Postgres + MinIO, PowerSync, création d'une société, connexion) : [`docs/GETTING_STARTED.md`](docs/GETTING_STARTED.md).
>
> 👥 Tu rejoins le projet en tant que développeur et dois te connecter au backend **existant** (sans rien recréer) : [`docs/ONBOARDING_COLLABORATEUR.md`](docs/ONBOARDING_COLLABORATEUR.md).

## 📋 Plan du projet

Le plan détaillé complet (modèle de données, règles métier, modules, définition de fini) est disponible dans [`docs/PROJECT_PLAN.md`](docs/PROJECT_PLAN.md).

## 📄 Licence

Tous droits réservés a BesmaAI.