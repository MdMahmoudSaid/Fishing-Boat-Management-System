-- Row Level Security — isolation par company_id.
--
-- Contexte de session : les routes API authentifiées (/api/sync/write en
-- particulier, voir lib/postgres/withCompanyContext.ts) positionnent
-- `app.company_id` et `app.user_id` via `set_config(..., true)` (portée
-- transaction) au début de chaque transaction, à partir des claims du JWT
-- vérifié. Ces policies ne lisent que ce contexte de session — plus de
-- dépendance à un fournisseur d'auth externe (auth.uid() était fourni par
-- Supabase Auth).
--
-- Le rôle `app` (créé manuellement via db/app_role_setup.sql, voir
-- docs/GETTING_STARTED.md) est RLS-restreint : contrairement à
-- powersync_role (bypassrls), toute requête qu'il exécute passe par ces
-- policies.

create schema if not exists private;

create or replace function private.user_company_id()
returns uuid
language sql
security definer
set search_path = ''
stable
as $$
  select nullif(current_setting('app.company_id', true), '')::uuid
$$;

revoke execute on function private.user_company_id() from public;
grant execute on function private.user_company_id() to app;

alter table public.companies enable row level security;

create policy companies_select on public.companies
  for select to app
  using (id = (select private.user_company_id()));

create policy companies_update on public.companies
  for update to app
  using (id = (select private.user_company_id()))
  with check (id = (select private.user_company_id()));

alter table public.users enable row level security;

create policy users_select_self on public.users
  for select to app
  using (id = (nullif(current_setting('app.user_id', true), ''))::uuid);

-- Toutes les autres tables : isolation directe par company_id.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'boats', 'crew_members', 'fish_categories', 'fish_quality_levels',
    'expense_categories', 'buyers', 'trips', 'trip_crew', 'expenses',
    'catches', 'sales', 'sale_payments', 'settings'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format(
      'create policy %I on public.%I for all to app using (company_id = (select private.user_company_id())) with check (company_id = (select private.user_company_id()))',
      table_name || '_company_isolation', table_name
    );
  end loop;
end $$;
