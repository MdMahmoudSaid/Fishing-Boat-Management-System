-- Bucket de stockage pour les photos de reçus de dépenses (§3, §4.11 du
-- PROJECT_PLAN). Bucket privé : l'accès passe par des policies RLS scopées
-- sur company_id, dérivé du premier segment du chemin du fichier
-- ({company_id}/{expense_id}.jpg) — cohérent avec l'isolation utilisée sur
-- les tables (private.user_company_id(), voir migration précédente).
--
-- INSERT + SELECT + UPDATE sont nécessaires : un upsert (upload avec
-- remplacement) échoue silencieusement si UPDATE manque.

insert into storage.buckets (id, name, public)
values ('expense-photos', 'expense-photos', false)
on conflict (id) do nothing;

create policy expense_photos_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'expense-photos'
    and (select private.user_company_id())::text = (storage.foldername(name))[1]
  );

create policy expense_photos_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'expense-photos'
    and (select private.user_company_id())::text = (storage.foldername(name))[1]
  );

create policy expense_photos_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'expense-photos'
    and (select private.user_company_id())::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'expense-photos'
    and (select private.user_company_id())::text = (storage.foldername(name))[1]
  );
