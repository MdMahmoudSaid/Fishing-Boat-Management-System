-- SaaS : provisionnement des companies depuis un panneau admin plutôt que
-- via scripts/seed-owner.ts en CLI (docs/GETTING_STARTED.md §7/§9).
--
-- Introduit un rôle `platform_admin`, transversal aux companies : ces
-- utilisateurs se connectent comme n'importe quel owner (téléphone + code),
-- mais n'appartiennent à aucune company (`company_id null`). Leurs écritures
-- passent exclusivement par le pool admin (DATABASE_URL, sans RLS) — voir
-- lib/admin/ — donc aucune policy RLS n'est nécessaire pour ce rôle.

alter table public.users alter column company_id drop not null;

-- Élargit la contrainte existante `check (role in ('owner'))` sans dépendre
-- de son nom auto-généré (non documenté ailleurs dans le schéma) : on la
-- retrouve dynamiquement via pg_constraint.
do $$
declare
  role_check_name text;
begin
  select con.conname into role_check_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  where rel.relname = 'users'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%role%';

  if role_check_name is not null then
    execute format('alter table public.users drop constraint %I', role_check_name);
  end if;
end $$;

alter table public.users
  add constraint users_role_check check (role in ('owner', 'platform_admin'));

-- Garde-fou explicite : un owner (ou tout futur rôle de company) a toujours
-- une company, un platform_admin n'en a jamais.
alter table public.users
  add constraint users_company_role_consistency check (
    (role = 'platform_admin' and company_id is null)
    or (role <> 'platform_admin' and company_id is not null)
  );

alter table public.companies
  add column is_active boolean not null default true;
