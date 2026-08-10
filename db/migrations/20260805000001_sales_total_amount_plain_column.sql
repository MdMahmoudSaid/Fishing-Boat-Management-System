-- `total_amount` était une colonne "generated always as (quantity * sale_price)
-- stored". Problème : le connecteur PowerSync envoie toujours la valeur
-- calculée côté client lors de l'upsert (offline-first : le client calcule
-- puis synchronise), et Postgres refuse toute écriture explicite sur une
-- colonne générée ("cannot insert/update a generated column"). On la
-- convertit en colonne normale, alimentée par l'app — même logique que
-- trip_crew.computed_amount.
alter table public.sales
  alter column total_amount drop expression if exists;

alter table public.sales
  alter column total_amount set not null;
