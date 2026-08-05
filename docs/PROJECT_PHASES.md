# Fishing Boat Management System — Development Phases Roadmap

> Companion document to `docs/PROJECT_PLAN.md` (the source of truth for all
> technical decisions). This document only sequences the work into
> buildable, testable phases. Each phase will get its own detailed
> implementation plan (task-by-task, TDD) when we start it.

Status: **proposed, pending validation** — no code has been written yet.

---

## Phase 0 — Setup projet & infra

**Objectif :** un squelette d'application qui build, se déploie, et parle à Supabase + PowerSync — sans aucune feature métier.

**Fichiers/dossiers à créer :**
- `next.config.js`, `tsconfig.json`, `tailwind.config.ts`, `.env.example` (variables de §11)
- `/app/layout.tsx` (racine, `dir="rtl"`, `lang="ar"`)
- `/lib/supabase/client.ts` (client Supabase)
- `/lib/powersync/schema.ts` (schéma PowerSync miroir du schéma Postgres §4)
- `/lib/powersync/client.ts` (setup client PowerSync, connecteur)
- `/lib/i18n/ar.json` + `/lib/i18n/index.ts` (helper `t()`)
- `/lib/id/generateId.ts` (UUID v4 côté client)
- `/lib/calculations/` (dossier vide, prêt pour phases suivantes)
- `/components/ui/` (Button, Card, Input, Select, Modal, ConfirmDialog — primitives Tailwind minimales, réutilisées par toutes les phases suivantes pour les suppressions)
- `/public/manifest.json` + icônes placeholder + service worker (next-pwa)
- Migrations SQL Supabase pour **toutes** les tables de §4 (companies, users, boats, crew_members, fish_categories, fish_quality_levels, expense_categories, buyers, trips, trip_crew, expenses, catches, sales, sale_payments, settings) avec `company_id`, `created_at`, `deleted_at`. **Extension par rapport à §4** : `deleted_at` est aussi ajouté à `fish_categories`, `fish_quality_levels` et `expense_categories` (non listé explicitement dans le PROJECT_PLAN, mais nécessaire — voir règle de suppression ci-dessous)
- Sync Rules PowerSync (bucket global "tout synchronise" — un seul admin/une seule company en V1)

**Tâches précises :**
1. `create-next-app` (App Router, TypeScript, Tailwind)
2. Config RTL globale + police arabe
3. Création projet Supabase, exécution des migrations (schéma complet §4)
4. Setup PowerSync : service, sync rules, schéma client SQLite miroir
5. Connexion `next-pwa`, manifest.json, icônes de base
6. i18n : structure `ar.json` + fonction `t()`, même avec 2-3 clés de test
7. `generateId()` — UUID v4 généré côté client (aucun round-trip DB), utilisé par **tous** les formulaires de création dès la Phase 1 : requis par le offline-first (§4 : "IDs must be generatable client-side, offline"), sinon un trip créé en mer sans réseau n'a pas d'ID
8. Setup du test runner (Vitest, cohérent avec Next.js/TS) + un premier test trivial sur `generateId()`, pour que les Phases 5/6 puissent écrire des tests unitaires sans re-setup
9. Déploiement Vercel (page d'accueil placeholder) branché aux vraies env vars Supabase/PowerSync

**Critère de "terminé" (testable) :**
- `npm run dev` démarre sans erreur, page en RTL visible
- Les 15 tables existent dans Supabase avec les bonnes colonnes/FK
- Le client PowerSync se connecte et synchronise un schéma vide sans erreur (visible dans les logs)
- `generateId()` produit un UUID v4 valide sans appel réseau (testable en mode avion), et le test runner exécute ce test avec succès
- App déployée sur Vercel, accessible publiquement, installable comme PWA (Lighthouse PWA check passe)

---

## Phase 1 — Auth & Settings

**Objectif :** connexion admin persistante offline + configuration initiale de la company (catégories, unités, méthode de paiement équipage).

**Fichiers/dossiers à créer :**
- `/app/(auth)/login/page.tsx`
- `/lib/supabase/auth.ts` (login, session persistée, refresh silencieux)
- `/app/(app)/settings/page.tsx` + sous-écrans (fish-categories, fish-quality-levels, expense-categories, company)
- `/components/forms/FishCategoryForm.tsx`, `FishQualityLevelForm.tsx`, `ExpenseCategoryForm.tsx`
- `/lib/db/settings.ts`, `fishCategories.ts`, `fishQualityLevels.ts`, `expenseCategories.ts`
- Script de seed : création `companies` + `settings` + 8 `expense_categories` par défaut (Carburant, Nourriture, Eau, Glace, Équipement de pêche, Réparations, Frais de port, Avance équipage, Autre) au premier setup

**Tâches précises :**
1. Écran login (email/mot de passe) via Supabase Auth
2. Persistance de session (JWT stocké localement) — l'app doit s'ouvrir hors-ligne après un premier login réussi
3. Flow "premier démarrage" : création company + settings + seed des 8 catégories de dépenses par défaut
4. CRUD fish_categories (avec `default_unit`, liste extensible d'unités, pas d'enum en dur)
5. CRUD fish_quality_levels (rattachées à une fish_category)
6. CRUD expense_categories (+ ajout de nouvelles catégories au-delà des 8 par défaut)
7. Règle de suppression (fish_categories, fish_quality_levels, expense_categories) : **soft delete uniquement, jamais de hard delete** — ces entités sont potentiellement référencées par des catches/expenses existantes. Un élément soft-deleted disparaît des pickers de création (nouvelle capture/dépense) mais reste affiché en lecture seule sur les enregistrements historiques qui le référencent déjà
8. Réglage `default_crew_payment_method` dans settings
9. Ajout des chaînes ar.json pour login + settings

**Critère de "terminé" (testable) :**
- Login réussit en ligne, session persiste après fermeture app + mode avion (réouverture sans re-login)
- Les 8 catégories de dépenses par défaut existent après le premier setup
- CRUD complet sur fish_categories/fish_quality_levels/expense_categories fonctionne hors-ligne, se synchronise à la reconnexion
- Supprimer une catégorie utilisée par un enregistrement existant (simulé avec données de test) : la catégorie disparaît des pickers de création mais reste visible sur l'enregistrement historique — aucun hard delete effectué

---

## Phase 2 — Boats / Crew / Buyers

**Objectif :** gestion des trois référentiels de base utilisés partout ensuite dans les sorties.

**Fichiers/dossiers à créer :**
- `/app/(app)/boats/page.tsx`, `/app/(app)/boats/[id]/page.tsx`
- `/app/(app)/crew/page.tsx`
- `/app/(app)/buyers/page.tsx`
- `/components/forms/BoatForm.tsx`, `CrewMemberForm.tsx`, `BuyerForm.tsx`
- `/lib/db/boats.ts`, `crewMembers.ts`, `buyers.ts`

**Tâches précises :**
1. CRUD boats (name, registration_number, captain_name, notes, status)
2. CRUD crew_members (name, phone, notes)
3. CRUD buyers (name, phone, notes)
4. Soft delete partout (`deleted_at`) avec `ConfirmDialog` obligatoire, éléments supprimés exclus des listes actives
5. Liste boats : colonnes agrégées (nombre de sorties, revenus, dépenses, profit) — requête branchée dès maintenant même si elle renverra 0 tant que la Phase 3+ n'existe pas

**Critère de "terminé" (testable) :**
- Créer/éditer/supprimer (soft) un bateau, un membre d'équipage, un acheteur — hors-ligne, avec confirmation avant suppression
- Élément soft-deleted disparaît de la liste mais reste en base (vérifiable via requête SQLite locale)
- Liste boats affiche les colonnes agrégées (à 0 pour l'instant, sans erreur)

---

## Phase 3 — Trips

**Objectif :** cœur du système — créer une sortie, l'assigner à un bateau/équipage, la faire transitionner de statut avec les règles métier de §7.

**Fichiers/dossiers à créer :**
- `/app/(app)/trips/page.tsx`, `/app/(app)/trips/[id]/page.tsx`
- `/components/forms/TripForm.tsx`, `TripCrewAssignmentForm.tsx`
- `/lib/db/trips.ts`, `tripCrew.ts`
- `/lib/calculations/tripValidation.ts` (règle "un seul trip actif par bateau", règle "closed requiert actual_return_date")

**Tâches précises :**
1. Créer/éditer une sortie : boat_id, captain_name (override optionnel), departure_date, expected_return_date, crew_payment_method (défaut = settings, overridable)
2. Assignation équipage (trip_crew) : payment_type fixed/percentage, fixed_amount ou percentage
3. Transitions de statut : preparing → at_sea → returned → closed, avec boutons d'action explicites
4. Validation : bloquer la création/activation d'un 2e trip actif (`preparing`/`at_sea`/`returned`) sur le même bateau
5. Validation : bloquer passage à `closed` sans `actual_return_date` renseigné
6. Mise à jour du `status` du boat en cohérence avec la réalité physique (pas le statut administratif du trip) : `in_trip` uniquement pendant `preparing`/`at_sea` ; dès que le trip passe à `returned`, le bateau redevient `active` (le bateau est physiquement au port et peut repartir ou être réassigné, même si le trip reste administrativement ouvert le temps de vendre le poisson)

**Note importante :** la validation "un seul trip actif par bateau" (§7) se base sur l'état des lignes de la table `trips` (`status != 'closed'`), **pas** sur `boat.status` — les deux champs sont désormais découplés (voir tâche 6). Un bateau peut afficher `active` (au port) tout en ayant encore un trip `returned` non clôturé qui bloque une nouvelle sortie.

**Critère de "terminé" (testable) :**
- Créer une sortie, assigner équipage, la faire progresser à travers les 4 statuts, hors-ligne
- Tenter de créer une 2e sortie active sur le même bateau → bloqué avec message d'erreur clair (arabe), y compris quand le trip existant est en `returned` et que le bateau affiche déjà `active`
- Tenter de clôturer sans date de retour → bloqué
- Le bateau passe à `in_trip` au démarrage du trip (`preparing`), reste `in_trip` en `at_sea`, puis repasse à `active` dès `returned`

---

## Phase 4 — Expenses & Catches

**Objectif :** saisie des dépenses (avec photos hors-ligne) et des captures, rattachées obligatoirement à une sortie.

**Fichiers/dossiers à créer :**
- `/app/(app)/trips/[id]/expenses/page.tsx`
- `/app/(app)/trips/[id]/catches/page.tsx`
- `/components/forms/ExpenseForm.tsx`, `CatchForm.tsx`
- `/lib/sync/photoUploadQueue.ts` (IndexedDB pending_upload → upload Supabase Storage → retry avec backoff)
- `/lib/db/expenses.ts`, `catches.ts`

**Tâches précises :**
1. Formulaire dépense : trip_id (obligatoire, jamais null), catégorie (picker + "ajouter une catégorie" inline), montant (> 0), date, description
2. Capture photo → sauvegarde locale IndexedDB, `photo_local_status = 'pending_upload'`
3. Listener de synchro : dès `navigator.onLine`, tente l'upload vers Supabase Storage, met à jour `photo_url` + `photo_local_status = 'uploaded'`, retry avec backoff si échec
4. Formulaire capture : fish_category_id, fish_quality_level_id, quantity (> 0), unit (défaut = default_unit de la catégorie, éditable), estimated_price
5. Totaux auto par sortie (somme dépenses, somme captures par catégorie/qualité)
6. Validation positive (> 0) sur amount/quantity avant submit

**Critère de "terminé" (testable) :**
- Ajouter une dépense avec photo en mode avion → statut `pending_upload` visible
- Revenir en ligne → photo uploadée dans Supabase Storage, `photo_url` correctement lié à la dépense
- Ajouter des lignes de capture, totaux corrects, validation bloque les valeurs ≤ 0

---

## Phase 5 — Sales & Inventaire

**Objectif :** vente contre stock disponible, paiements partiels, vue inventaire dérivée.

**Fichiers/dossiers à créer :**
- `/app/(app)/trips/[id]/sales/page.tsx`
- `/app/(app)/trips/[id]/inventory/page.tsx` (+ vue agrégée company-wide dans dashboard plus tard)
- `/components/forms/SaleForm.tsx`, `SalePaymentForm.tsx`
- `/lib/calculations/inventory.ts` (stock restant = SUM(catches.quantity) − SUM(sales.quantity) par trip+fish+quality)
- `/lib/calculations/inventory.test.ts`
- `/lib/db/sales.ts`, `salePayments.ts`

**Tâches précises :**
1. Calcul stock restant par trip+fish_category+fish_quality (lecture locale SQLite uniquement) — fonction pure dans `inventory.ts`
2. Tests unitaires de `inventory.ts` : stock exact avec plusieurs catches/sales, stock à 0, cas de dépassement
3. Formulaire vente : buyer_id, fish_category_id, fish_quality_level_id, quantity (validée ≤ stock restant), sale_price, total_amount calculé
4. Enregistrement paiement (sale_payments) : total, partiel, ou différé
5. Calcul solde acheteur = SUM(sales.total_amount) − SUM(sale_payments.amount)
6. Vue inventaire par sortie + agrégée toutes sorties

**Critère de "terminé" (testable) :**
- Tenter une vente dépassant le stock restant → bloquée avec message clair
- Vue inventaire se met à jour immédiatement après une vente, hors-ligne
- Paiement partiel enregistré → solde acheteur reflète correctement le reste dû
- `npm run test` passe sur `inventory.test.ts` (cas nominal + dépassement + stock épuisé)

---

## Phase 6 — Dashboard & Reports

**Objectif :** calcul de profit finalisé, tableau de bord, rapports, recherche/filtres.

**Fichiers/dossiers à créer :**
- `/app/(app)/dashboard/page.tsx`
- `/app/(app)/reports/page.tsx` + sous-vues (boat, trip, expense, sales, customer-debt)
- `/lib/calculations/profit.ts` (gross sales − expenses − crew payment total)
- `/lib/calculations/profit.test.ts`
- `/lib/calculations/crewPayment.ts` (fixed / percentage_gross / percentage_after_expenses)
- `/lib/calculations/crewPayment.test.ts`
- Ajout de recherche + filtres (date/boat/trip) sur les listes boats, trips, expenses, sales, catches

**Tâches précises :**
1. Calcul profit sortie en temps réel (live-updating pendant que expenses/sales/crew changent) — fonction pure dans `profit.ts`
2. Calcul `crewPayment.ts` pour les 3 méthodes (fixed / percentage_gross / percentage_after_expenses) — fonction pure, prend en entrée les montants déjà calculés (gross, expenses) et la config du trip_crew
3. Tests unitaires `profit.test.ts` et `crewPayment.test.ts` : au moins un cas par méthode de paiement équipage, plus un cas avec plusieurs membres d'équipage mixant fixed et percentage sur le même trip
4. Finalisation/cache de `trip_crew.computed_amount` au moment où le trip passe à `closed`, selon la méthode de paiement
5. Dashboard : cartes agrégées (bateaux, sorties actives, sorties terminées, revenu total, dépenses totales, paiements équipage totaux, profit net, valeur stock invendu, dette clients totale) + liste des sorties récentes
6. Rapports : Boat Report, Trip Report, Expense Report (groupé par catégorie), Sales Report (groupé par date/poisson/acheteur), Customer Debt Report
7. Recherche + filtres sur chaque liste majeure

**Critère de "terminé" (testable) :**
- Chiffres du dashboard vérifiés manuellement contre les données brutes d'un jeu de test
- `computed_amount` correct pour les 3 méthodes de paiement équipage, verrouillé après clôture (ne change plus si des ventes sont ajoutées après)
- `npm run test` passe sur `profit.test.ts` et `crewPayment.test.ts`
- Chaque rapport affiche les bonnes données groupées ; filtres/recherche fonctionnent sur toutes les listes

---

## Phase 7 — PWA/Offline hardening & Déploiement

**Objectif :** valider le critère central du projet — 100% offline — et livrer en production.

**Tâches précises :**
1. Audit systématique de chaque écran précédent : create/edit/read en mode avion
2. Vérifier la reprise de synchro propre à la reconnexion (aucune perte, aucun doublon)
3. Vérifier la file d'attente photo de bout en bout en conditions réelles
4. Vérifier la persistance de session à froid (fermeture totale app + mode avion + réouverture)
5. Finaliser manifest.json, icônes, service worker (cache app shell)
6. Configurer instances Supabase + PowerSync de production
7. Déploiement Vercel production

**Critère de "terminé" (testable) — reprend §12 du PROJECT_PLAN :**
- Tous les modules fonctionnent offline (create/read/update, sync au retour du réseau)
- App installable comme PWA, utilisable en mode avion dès le premier lancement après un premier login
- File d'attente photo vérifiée bout en bout (photo prise offline → visible dans Supabase Storage → liée à la bonne dépense)
- Déployé et accessible sur Vercel avec Supabase + PowerSync de production configurés

---

## Notes de dépendance entre phases

- Phase 2 (boats) affiche des agrégats qui resteront à 0 jusqu'à ce que Phase 3-5 existent — c'est attendu, pas un bug.
- Phase 6 (profit/crew payment) est le seul calcul vraiment complexe : il dépend de données de Phase 3 (trip_crew), 4 (expenses) et 5 (sales) toutes en place. C'est pourquoi ses fonctions (`profit.ts`, `crewPayment.ts`) sont couvertes par des tests unitaires dès leur écriture, plutôt qu'en fin de projet.
- `boat.status` (Phase 3) et `trip.status` sont deux champs découplés : le premier reflète l'état physique du bateau, le second l'état administratif du trip. La règle "un seul trip actif par bateau" (§7) ne lit jamais `boat.status` — toujours `trips.status != 'closed'` directement.
- Règle de suppression uniforme sur tout le projet : **aucun hard delete, jamais**, sur une entité potentiellement référencée ailleurs (boats, trips, crew, buyers dès §7 ; fish_categories, fish_quality_levels, expense_categories par extension dès Phase 1). Toujours `deleted_at` + exclusion des pickers + visibilité en lecture seule sur l'historique.
- Phase 7 n'ajoute aucune feature — c'est une passe de validation/durcissement sur tout ce qui précède.
