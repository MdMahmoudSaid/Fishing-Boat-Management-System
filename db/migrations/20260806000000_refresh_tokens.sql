-- Refresh tokens (révocation server-side) — remplace la gestion de session
-- de Supabase Auth. Le token n'est jamais stocké en clair (voir
-- lib/auth/refreshTokens.ts) ; sa révocation (logout, rotation à chaque
-- refresh) se fait en supprimant la ligne.
create table public.refresh_tokens (
  id uuid primary key,
  user_id uuid not null references public.users (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index refresh_tokens_user_id_idx on public.refresh_tokens (user_id);
