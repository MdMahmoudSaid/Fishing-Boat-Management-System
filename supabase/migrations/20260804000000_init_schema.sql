  -- Fishing Boat Management System — schéma initial (PROJECT_PLAN.md §4)
  --
  -- Toutes les tables utilisent des UUID générés côté client (aucun
  -- `default gen_random_uuid()`) : l'app doit toujours fournir un id créé
  -- hors-ligne via lib/id/generateId.ts, condition nécessaire à l'offline-first.
  --
  -- Extension par rapport à §4 (documentée dans docs/PROJECT_PHASES.md) :
  --   - `deleted_at` ajouté à fish_categories, fish_quality_levels,
  --     expense_categories : soft-delete uniquement, jamais de hard delete
  --     sur une entité potentiellement référencée par des catches/expenses.
  --   - `company_id` dénormalisé sur trip_crew, expenses, catches, sales,
  --     sale_payments (dérivable via trip_id -> trips.company_id) pour
  --     permettre des politiques RLS simples et indexées, sans jointure
  --     multi-niveaux à chaque requête.

  create table public.companies (
    id uuid primary key,
    name text not null,
    currency text not null default 'MRU',
    created_at timestamptz not null default now()
  );

  create table public.users (
    id uuid primary key references auth.users (id) on delete cascade,
    company_id uuid not null references public.companies (id),
    name text not null,
    email text not null unique,
    password_hash text,
    role text not null default 'owner' check (role in ('owner')),
    created_at timestamptz not null default now()
  );
  create index users_company_id_idx on public.users (company_id);

  create table public.boats (
    id uuid primary key,
    company_id uuid not null references public.companies (id),
    name text not null,
    registration_number text,
    captain_name text,
    notes text,
    status text not null default 'active'
      check (status in ('active', 'maintenance', 'in_trip')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz
  );
  create index boats_company_id_idx on public.boats (company_id);

  create table public.crew_members (
    id uuid primary key,
    company_id uuid not null references public.companies (id),
    name text not null,
    phone text,
    notes text,
    created_at timestamptz not null default now(),
    deleted_at timestamptz
  );
  create index crew_members_company_id_idx on public.crew_members (company_id);

  create table public.fish_categories (
    id uuid primary key,
    company_id uuid not null references public.companies (id),
    name text not null,
    -- Chaîne libre (pas d'enum) : nouvelles unités ajoutables depuis les
    -- réglages sans migration, comme demandé en §4.5.
    default_unit text not null,
    notes text,
    created_at timestamptz not null default now(),
    deleted_at timestamptz
  );
  create index fish_categories_company_id_idx on public.fish_categories (company_id);

  create table public.fish_quality_levels (
    id uuid primary key,
    company_id uuid not null references public.companies (id),
    fish_category_id uuid references public.fish_categories (id),
    name text not null,
    default_price numeric(12, 2),
    created_at timestamptz not null default now(),
    deleted_at timestamptz
  );
  create index fish_quality_levels_company_id_idx on public.fish_quality_levels (company_id);
  create index fish_quality_levels_fish_category_id_idx on public.fish_quality_levels (fish_category_id);

  create table public.expense_categories (
    id uuid primary key,
    company_id uuid not null references public.companies (id),
    name text not null,
    is_default boolean not null default false,
    created_at timestamptz not null default now(),
    deleted_at timestamptz
  );
  create index expense_categories_company_id_idx on public.expense_categories (company_id);

  create table public.buyers (
    id uuid primary key,
    company_id uuid not null references public.companies (id),
    name text not null,
    phone text,
    notes text,
    created_at timestamptz not null default now(),
    deleted_at timestamptz
  );
  create index buyers_company_id_idx on public.buyers (company_id);

  create table public.trips (
    id uuid primary key,
    company_id uuid not null references public.companies (id),
    boat_id uuid not null references public.boats (id),
    captain_name text,
    departure_date date not null,
    expected_return_date date,
    actual_return_date date,
    status text not null default 'preparing'
      check (status in ('preparing', 'at_sea', 'returned', 'closed')),
    crew_payment_method text not null
      check (crew_payment_method in ('fixed', 'percentage_gross', 'percentage_after_expenses')),
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    -- §7 : un trip ne peut passer à 'closed' sans date de retour effective.
    constraint trips_closed_requires_actual_return_date
      check (status <> 'closed' or actual_return_date is not null)
  );
  create index trips_company_id_idx on public.trips (company_id);
  create index trips_boat_id_idx on public.trips (boat_id);
  -- Supporte la vérification "un seul trip actif par bateau" (§7).
  create index trips_boat_id_status_idx on public.trips (boat_id, status);

  create table public.trip_crew (
    id uuid primary key,
    company_id uuid not null references public.companies (id),
    trip_id uuid not null references public.trips (id),
    crew_member_id uuid not null references public.crew_members (id),
    payment_type text not null check (payment_type in ('fixed', 'percentage')),
    fixed_amount numeric(12, 2),
    percentage numeric(5, 2),
    computed_amount numeric(12, 2),
    constraint trip_crew_amount_matches_payment_type check (
      (payment_type = 'fixed' and fixed_amount is not null)
      or (payment_type = 'percentage' and percentage is not null)
    )
  );
  create index trip_crew_company_id_idx on public.trip_crew (company_id);
  create index trip_crew_trip_id_idx on public.trip_crew (trip_id);
  create index trip_crew_crew_member_id_idx on public.trip_crew (crew_member_id);

  create table public.expenses (
    id uuid primary key,
    company_id uuid not null references public.companies (id),
    trip_id uuid not null references public.trips (id),
    expense_category_id uuid not null references public.expense_categories (id),
    amount numeric(12, 2) not null check (amount > 0),
    date date not null,
    description text,
    photo_url text,
    photo_local_status text not null default 'none'
      check (photo_local_status in ('none', 'pending_upload', 'uploaded', 'failed')),
    created_at timestamptz not null default now()
  );
  create index expenses_company_id_idx on public.expenses (company_id);
  create index expenses_trip_id_idx on public.expenses (trip_id);

  create table public.catches (
    id uuid primary key,
    company_id uuid not null references public.companies (id),
    trip_id uuid not null references public.trips (id),
    fish_category_id uuid not null references public.fish_categories (id),
    fish_quality_level_id uuid not null references public.fish_quality_levels (id),
    quantity numeric(12, 2) not null check (quantity > 0),
    unit text not null,
    estimated_price numeric(12, 2),
    created_at timestamptz not null default now()
  );
  create index catches_company_id_idx on public.catches (company_id);
  create index catches_trip_id_idx on public.catches (trip_id);
  create index catches_trip_fish_quality_idx
    on public.catches (trip_id, fish_category_id, fish_quality_level_id);

  create table public.sales (
    id uuid primary key,
    company_id uuid not null references public.companies (id),
    trip_id uuid not null references public.trips (id),
    buyer_id uuid not null references public.buyers (id),
    fish_category_id uuid not null references public.fish_categories (id),
    fish_quality_level_id uuid not null references public.fish_quality_levels (id),
    quantity numeric(12, 2) not null check (quantity > 0),
    sale_price numeric(12, 2) not null check (sale_price > 0),
    total_amount numeric(12, 2) generated always as (quantity * sale_price) stored,
    date date not null,
    created_at timestamptz not null default now()
  );
  create index sales_company_id_idx on public.sales (company_id);
  create index sales_trip_id_idx on public.sales (trip_id);
  create index sales_buyer_id_idx on public.sales (buyer_id);
  create index sales_trip_fish_quality_idx
    on public.sales (trip_id, fish_category_id, fish_quality_level_id);

  create table public.sale_payments (
    id uuid primary key,
    company_id uuid not null references public.companies (id),
    sale_id uuid not null references public.sales (id),
    amount numeric(12, 2) not null check (amount > 0),
    date date not null,
    notes text,
    created_at timestamptz not null default now()
  );
  create index sale_payments_company_id_idx on public.sale_payments (company_id);
  create index sale_payments_sale_id_idx on public.sale_payments (sale_id);

  create table public.settings (
    id uuid primary key,
    company_id uuid not null unique references public.companies (id),
    default_crew_payment_method text not null
      check (default_crew_payment_method in ('percentage_gross', 'percentage_after_expenses')),
    currency text not null default 'MRU',
    language text not null default 'ar'
  );

  -- Maintien de `updated_at` sur les tables qui l'exposent.
  create or replace function public.set_updated_at()
  returns trigger
  language plpgsql
  as $$
  begin
    new.updated_at = now();
    return new;
  end;
  $$;

  create trigger boats_set_updated_at
    before update on public.boats
    for each row execute function public.set_updated_at();

  create trigger trips_set_updated_at
    before update on public.trips
    for each row execute function public.set_updated_at();
