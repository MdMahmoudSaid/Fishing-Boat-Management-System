# Fishing Boat Management System — V1 Project Plan

## 0. Purpose of This Document

This document is the single source of truth for building this application. It contains every decision needed to build Version 1 end-to-end without further clarification. Follow it precisely. Where a detail is not specified, choose the simplest reasonable implementation consistent with the rest of this document and the stack below.

---

## 1. Project Summary

A mobile-first, offline-first Progressive Web App (PWA) for a single fishing company to manage the full lifecycle of fishing trips: boats, trips, expenses, catches, inventory, sales, buyers, crew payments, and profit reporting. Single admin user in V1. Arabic (RTL) primary language, built for extension to other languages later. Fixed currency: MRU (Mauritanian Ouguiya).

**Core principle the whole system is built around:** for every trip, the owner must instantly see catch quantity, quantity sold, remaining stock, trip cost, amount owed to crew, and net profit — and which boats are profitable.

---

## 2. Tech Stack (Fixed — do not substitute)

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router, TypeScript) |
| Database | PostgreSQL, self-hébergé (Docker, VPS) |
| File/Photo storage | MinIO (S3-compatible, self-hébergé) |
| Offline sync engine | PowerSync Cloud (client SQLite via WASM, syncs to self-hosted Postgres) |
| Hosting | Vercel |
| Auth | JWT maison (téléphone + code à 4 chiffres, voir §6) |
| Styling | Tailwind CSS |
| PWA | next-pwa or equivalent service worker setup, installable, offline app shell |
| Language | Arabic (RTL) primary UI; all strings must be centralized in a translation file (even if only Arabic exists in V1) so more languages can be added later without restructuring |

### Why this stack (context for implementation decisions)
- Single admin, single active device at a time → no complex multi-user conflict resolution needed. PowerSync's default last-write-wins is sufficient.
- All read AND write operations must work fully offline (not just caching) — the local SQLite database (managed by PowerSync) is the actual source of truth the UI reads/writes to. Every screen queries the local PowerSync SQLite DB, never a live API call directly, so the app works fully offline. PowerSync handles background sync to Postgres transparently.
- Photos taken offline are stored in local browser storage (IndexedDB/local blob) first, queued, and uploaded to MinIO automatically once connectivity returns.

---

## 3. Architecture Overview

```
[Next.js PWA - Vercel]
   |
   |-- reads/writes --> [PowerSync Client SQLite (local, in-browser)]
   |                         |
   |                         |-- sync --> [PowerSync Service]
   |                                          |
   |                                          |-- API Next.js (/api/sync/write, /api/auth/*, /api/photos/*)
   |                                          |
   |                                          v
   |                                     [Postgres self-hébergé]
   |
   |-- direct upload (when online) --> [MinIO] (expense receipt photos)
```

- All CRUD operations in the UI go through the local PowerSync SQLite database.
- PowerSync Sync Rules (server-side config) define what data syncs down (in V1: everything, since there's one company/one admin — no per-user partitioning needed).
- Photo uploads are NOT synced through PowerSync (binary files aren't a fit for the SQLite sync layer). Implement a separate local upload queue: photo is saved to IndexedDB with status `pending_upload`, a background sync listener attempts upload to MinIO (via `/api/photos/upload`) when `navigator.onLine` is true, and updates the record with the resulting storage URL once successful. Retry with backoff on failure.
- Auth: since it's a PWA that must work fully offline including app *launch*, implement a persisted/cached session (e.g. long-lived JWT stored locally) so the admin doesn't get locked out of the app while offline. Login itself requires connectivity the first time; after that, session persists locally until expiry/logout.

---

## 4. Data Model

Design all tables with a `company_id` foreign key from day one, even though V1 has only one company — this makes multi-branch (a documented future feature) a non-breaking addition later. Similarly, design `user_id`/`created_by` fields even in single-admin V1, to make multi-user permissions (a documented future feature) additive later.

Use UUID primary keys throughout (required for offline-first: IDs must be generatable client-side, offline, without a database round-trip).

### 4.1 companies
- id (uuid, pk)
- name
- currency (default 'MRU', fixed in V1 UI but stored for future multi-currency)
- created_at

### 4.2 users
- id (uuid, pk)
- company_id (fk)
- name
- email (unique)
- password_hash (see §6 — superseded by phone + 4-digit code auth)
- role (enum: 'owner' — only value used in V1, but field exists for future roles)
- created_at

### 4.3 boats
- id (uuid, pk)
- company_id (fk)
- name
- registration_number (nullable)
- captain_name (nullable)
- notes (nullable)
- status (enum: 'active', 'maintenance', 'in_trip')
- created_at, updated_at, deleted_at (soft delete — see §8 validation rules on delete confirmation)

### 4.4 crew_members
- id (uuid, pk)
- company_id (fk)
- name
- phone (nullable)
- notes (nullable)
- created_at, deleted_at

### 4.5 fish_categories
- id (uuid, pk)
- company_id (fk)
- name
- default_unit (enum: 'kg', 'ton', 'box', 'piece' — extensible list, store as string not hard enum if possible so new units can be added via Settings without a migration)
- notes (nullable)
- created_at

### 4.6 fish_quality_levels
- id (uuid, pk)
- company_id (fk)
- fish_category_id (fk, nullable — a quality level could be global or per-category; default to per-category since spec says "each fish category can have different qualities")
- name (e.g. Premium, Grade A, Grade B, Damaged, Dead — all admin-created, not hardcoded)
- default_price (nullable, decimal)
- created_at

### 4.7 expense_categories
- id (uuid, pk)
- company_id (fk)
- name
- is_default (boolean — true for the 8 seeded defaults: Fuel, Food, Water, Ice, Fishing Equipment, Repairs, Port Fees, Crew Advance, Other)
- created_at

### 4.8 buyers
- id (uuid, pk)
- company_id (fk)
- name
- phone (nullable)
- notes (nullable)
- created_at, deleted_at

### 4.9 trips
- id (uuid, pk)
- company_id (fk)
- boat_id (fk)
- captain_name (nullable, can differ from boat's default captain)
- departure_date
- expected_return_date (nullable)
- actual_return_date (nullable)
- status (enum: 'preparing', 'at_sea', 'returned', 'closed')
- crew_payment_method (enum: 'fixed', 'percentage_gross', 'percentage_after_expenses' — defaults to company Setting but overridable per trip, per spec §16)
- notes (nullable)
- created_at, updated_at, deleted_at

### 4.10 trip_crew (join table — crew assigned to a trip)
- id (uuid, pk)
- trip_id (fk)
- crew_member_id (fk)
- payment_type (enum: 'fixed', 'percentage' — per crew member, since different crew could have different arrangements)
- fixed_amount (nullable, decimal)
- percentage (nullable, decimal — e.g. 25.00 meaning 25%)
- computed_amount (decimal, nullable — calculated and cached when trip closes, see §7 profit calc)

### 4.11 expenses
- id (uuid, pk)
- trip_id (fk, required — every expense belongs to a trip, no orphan expenses per validation rules)
- expense_category_id (fk)
- amount (decimal, must be positive)
- date
- description (nullable)
- photo_url (nullable — populated after successful upload; see §3 upload queue)
- photo_local_status (enum: 'none', 'pending_upload', 'uploaded', 'failed' — client-side tracking field)
- created_at

### 4.12 catches (catch registration lines)
- id (uuid, pk)
- trip_id (fk)
- fish_category_id (fk)
- fish_quality_level_id (fk)
- quantity (decimal, must be positive)
- unit (string, defaults to fish category's default_unit but editable per line)
- estimated_price (nullable, decimal)
- created_at

### 4.13 sales
- id (uuid, pk)
- trip_id (fk)
- buyer_id (fk)
- fish_category_id (fk)
- fish_quality_level_id (fk)
- quantity (decimal, must be positive, must not exceed remaining stock for that trip+fish+quality combination — see §8 validation)
- sale_price (decimal, per unit)
- total_amount (decimal, = quantity * sale_price, computed)
- date
- created_at

### 4.14 sale_payments (supports partial/later payment per spec §14)
- id (uuid, pk)
- sale_id (fk)
- amount (decimal, positive)
- date
- notes (nullable)
- created_at

### 4.15 settings
- id (uuid, pk)
- company_id (fk, unique — one settings row per company)
- default_crew_payment_method (enum: 'percentage_gross', 'percentage_after_expenses')
- currency (default 'MRU')
- language (default 'ar')

### Derived / computed values (do not persist redundantly where avoidable — compute in queries or view layer)
- Trip gross sales = SUM(sales.total_amount) for that trip
- Trip total expenses = SUM(expenses.amount) for that trip
- Trip crew payment total = SUM(trip_crew.computed_amount) for that trip
- Trip net profit = gross sales − total expenses − crew payment total
- Stock remaining per trip+fish+quality = SUM(catches.quantity) − SUM(sales.quantity) for matching trip/fish/quality
- Buyer outstanding balance = SUM(sales.total_amount) − SUM(sale_payments.amount) for that buyer

---

## 5. Feature Modules (build in this order)

Build V1 as one complete release (not phased), but implement in this dependency order since later modules depend on earlier ones existing:

1. **Auth & Company setup** — login screen, session persistence (works offline after first login), initial company/settings creation flow.
2. **Settings module** — fish categories, fish quality levels, expense categories (seed the 8 defaults), units, default crew payment method, company info, currency (fixed display MRU).
3. **Boats module** — CRUD, status field, list view showing trip count/revenue/expenses/profit per boat (aggregate queries against local SQLite).
4. **Crew module** — CRUD for crew members.
5. **Buyers module** — CRUD for buyers.
6. **Trips module** — create/edit trip, assign boat + crew + payment method, status transitions (Preparing → At Sea → Returned → Closed) with the validation that only one active trip (status != closed) may exist per boat at a time.
7. **Expenses module** — add expense to a trip, category picker (with inline "add new category" per spec), photo capture with offline queue upload.
8. **Catch registration** — add catch lines to a trip (fish/quality/quantity/unit/estimated price), auto-totals.
9. **Inventory view** — derived from catches − sales, shown per trip and aggregated company-wide.
10. **Sales module** — record a sale against a trip's available stock, validate against remaining inventory, buyer selection, payment recording (full/partial/later).
11. **Profit calculation** — implement the trip summary calc (§4, derived values) live-updating as expenses/sales/crew data change; finalize/cache crew computed_amount when trip is closed.
12. **Dashboard** — aggregate cards (total boats, active trips, completed trips, total revenue, total expenses, total crew payments, net profit, unsold fish value, outstanding customer debt) + recent trips list.
13. **Reports module** — Boat Report, Trip Report, Expense Report (grouped by category), Sales Report (grouped by date/fish/buyer), Customer Debt Report.
14. **Search & filters** — add search + date/boat/trip filters to every major list view (boats, trips, expenses, sales, catches).
15. **PWA/offline hardening pass** — verify every screen above works fully offline (create, edit, read), verify sync recovers cleanly after reconnect, verify photo upload queue, verify session persistence offline.

---

## 6. Auth Details

- Single role in V1: `owner`. Login with Mauritanian phone number (8 digits) + a 4-digit code (not a classic password).
- JWT maison (home-grown), not a third-party auth provider: `POST /api/auth/login` checks `phone` + `code_hash` (bcrypt) against `public.users` and issues an `{accessToken, refreshToken}` pair signed HS256 with `JWT_SECRET`. `POST /api/auth/refresh` rotates the access token from a stored refresh token (`refresh_tokens` table); `POST /api/auth/logout` revokes it. Claims: `sub` (user id), `company_id`, `role`, `exp`.
- Same `JWT_SECRET` is configured as the PowerSync instance's "Client Auth" verification secret, so PowerSync trusts the tokens our own backend issues.
- Persist the session client-side (`lib/auth/AuthProvider.tsx` / `authClient.ts`) so the PWA can be opened and used fully offline after the first successful login (no forced re-authentication while offline). Access token is short-lived (~1h); refresh token is long-lived (~90 days) and refreshed silently when back online.
- No signup screen needed in V1 — the single owner account is created via a seed script (`npm run seed`) / initial setup flow, not public registration.
- Full design rationale and migration details: `docs/superpowers/specs/2026-08-10-supabase-to-postgres-migration-design.md`.

---

## 7. Business Rules & Validation (must be enforced in the app, ideally also at the DB level via constraints where practical)

- A boat cannot have more than one active trip (status in `preparing`, `at_sea`, `returned`) at the same time — enforce with an app-level check before insert, since offline-first makes DB-level unique partial indexes harder to rely on across sync.
- Sales quantity cannot exceed remaining inventory for that trip/fish/quality combination — validate against the locally computed stock figure at the moment of entry.
- Every expense must have a `trip_id` — never nullable, no "general" expenses in V1.
- A trip cannot move to `closed` status until `actual_return_date` is set (i.e. boat has returned).
- All quantity and price fields must be validated as positive numbers (> 0) in the UI before submit.
- Deleting a boat, trip, crew member, or buyer requires an explicit confirmation dialog. Use soft delete (`deleted_at` timestamp) rather than hard delete, so historical trip data stays intact even if e.g. a boat is later "deleted."

---

## 8. Non-Functional Requirements

- **Mobile-first**: design every screen for a phone viewport first; large tap targets, minimal typing where possible (pickers/dropdowns over free text for repeated entities like fish type, buyer, crew).
- **RTL Arabic**: use `dir="rtl"` at the app root, verify all Tailwind spacing/icons mirror correctly, store UI strings in a single i18n dictionary file (even with only one language in V1) so English or French can be added later without touching component code.
- **PWA**: installable (manifest.json + icons), app shell caches for instant offline load, works with zero network from cold start after first install/login.
- **Performance**: dashboard and list views should read from local SQLite only — never block on network.
- **Currency display**: format all monetary values with "MRU" suffix, no decimal complexity needed beyond standard 2-decimal rounding.

---

## 9. Explicitly Out of Scope for V1 (do not build, but schema should not block adding later)

- Multiple companies/branches (schema already has `company_id` to support this later)
- Multiple users/roles beyond `owner` (schema already has `user_id`/`role` fields to support this later)
- Multiple warehouses
- GPS tracking
- Fuel consumption analysis
- Boat maintenance scheduling
- Payroll (beyond simple trip-based crew payment already specified)
- Export to Excel/PDF
- Native mobile app (PWA covers this need for V1)
- Push notifications
- Supplier management / purchase orders
- Accounting system integration
- Multi-currency (schema has the field, UI is MRU-only)
- Multi-language UI (i18n structure exists, only Arabic strings populated)

---

## 10. Suggested Project Structure

```
/app                      → Next.js App Router pages
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
  /powersync              → PowerSync client setup, schema definition
  /postgres                → Server-side Postgres access (pool, RLS, sync-write queries)
  /auth                     → Home-grown JWT auth (session, client, provider)
  /db                       → local SQLite query helpers per entity
  /sync                     → photo upload queue logic
  /calculations             → profit/inventory/crew-payment computation functions (pure functions, unit-testable)
  /i18n                     → translation dictionary (ar.json to start)
/components
  /ui                        → shared buttons, cards, form inputs (Tailwind)
  /forms                     → entity-specific forms (BoatForm, TripForm, ExpenseForm, etc.)
/public
  manifest.json, icons, service worker assets
```

---

## 11. Environment Variables Needed

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

---

## 12. Definition of Done for V1

- Every module in §5 implemented and fully functional offline (create/read/update, sync on reconnect).
- Dashboard figures match manually-verified totals from underlying trip data.
- All validation rules in §7 enforced with clear user-facing error messages (in Arabic).
- App installable as PWA on a phone, loads and is fully operable with airplane mode on after first login.
- Photo upload queue verified: take a photo offline, go back online, confirm it appears in MinIO and is linked to the correct expense.
- Deployed and reachable on Vercel with production Postgres/MinIO + PowerSync instances configured.
