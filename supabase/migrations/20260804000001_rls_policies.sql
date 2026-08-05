-- Row Level Security — isolation par company_id.
--
-- V1 n'a qu'une seule company/un seul admin, mais le schéma est conçu pour
-- le multi-company (§4 du PROJECT_PLAN) : ces policies garantissent dès
-- maintenant qu'un utilisateur authentifié ne peut lire/écrire que les
-- lignes de sa propre company, au niveau base de données (pas seulement
-- côté app).
--
-- La création initiale de la company/du 1er owner (Phase 1, "flow premier
-- démarrage") se fait via un script serveur utilisant
-- SUPABASE_SERVICE_ROLE_KEY, qui contourne RLS — aucune policy d'INSERT
-- n'est donc nécessaire ici pour `companies`/`users`.

create schema if not exists private;

-- security definer + search_path vide : s'exécute avec les privilèges du
-- propriétaire de la fonction (bypass RLS sur public.users), évite les
-- lookups RLS répétés par ligne. auth.uid() est vérifié à l'intérieur.
create or replace function private.user_company_id()
returns uuid
language sql
security definer
set search_path = ''
stable
as $$
  select company_id from public.users where id = (select auth.uid())
$$;

revoke execute on function private.user_company_id() from public, anon;
grant execute on function private.user_company_id() to authenticated;

-- companies : lecture/mise à jour de sa propre company uniquement.
alter table public.companies enable row level security;

create policy companies_select on public.companies
  for select to authenticated
  using (id = (select private.user_company_id()));

create policy companies_update on public.companies
  for update to authenticated
  using (id = (select private.user_company_id()))
  with check (id = (select private.user_company_id()));

-- users : chaque utilisateur ne voit que sa propre ligne.
alter table public.users enable row level security;

create policy users_select_self on public.users
  for select to authenticated
  using (id = (select auth.uid()));

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
      'create policy %I on public.%I for all to authenticated using (company_id = (select private.user_company_id())) with check (company_id = (select private.user_company_id()))',
      table_name || '_company_isolation', table_name
    );
  end loop;
end $$;
