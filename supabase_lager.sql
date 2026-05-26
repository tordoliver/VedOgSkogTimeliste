-- Kjør dette i Supabase SQL Editor hvis du vil at lageret skal lagres felles for alle brukere.
-- Etterpå vil lager.html automatisk bruke Supabase-tabellene.

create table if not exists public.lager_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null default 'ved' check (type in ('ved', 'utstyr', 'annet')),
  unit text not null default 'stk',
  quantity numeric not null default 0,
  unit_value numeric not null default 0,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lager_hendelser (
  id uuid primary key default gen_random_uuid(),
  item_id uuid references public.lager_items(id) on delete set null,
  item_name text,
  type text not null check (type in ('sell', 'produce', 'buy', 'adjust')),
  quantity numeric not null default 0,
  note text,
  actor_name text,
  created_at timestamptz not null default now()
);

alter table public.lager_items enable row level security;
alter table public.lager_hendelser enable row level security;

drop policy if exists "Innloggede kan lese lager" on public.lager_items;
drop policy if exists "Innloggede kan endre lager" on public.lager_items;
drop policy if exists "Innloggede kan lese lagerhendelser" on public.lager_hendelser;
drop policy if exists "Innloggede kan legge til lagerhendelser" on public.lager_hendelser;

create policy "Innloggede kan lese lager"
  on public.lager_items for select
  to authenticated
  using (true);

create policy "Innloggede kan endre lager"
  on public.lager_items for all
  to authenticated
  using (true)
  with check (true);

create policy "Innloggede kan lese lagerhendelser"
  on public.lager_hendelser for select
  to authenticated
  using (true);

create policy "Innloggede kan legge til lagerhendelser"
  on public.lager_hendelser for insert
  to authenticated
  with check (true);
