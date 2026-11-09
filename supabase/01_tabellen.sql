-- Stap 1: maakt de tabellen en de beveiliging (Row Level Security) aan.
-- Plak dit in Supabase > SQL Editor > New query, en klik op Run.

-- De leerkaarten zelf
create table if not exists public.cards (
  id         text primary key,
  bron       text not null check (bron in ('Belfort', 'Carnegie')),
  groep      text not null,
  vraag      text not null,
  antwoord   text not null,
  uitleg     text,
  volgorde   int  not null default 0,
  created_at timestamptz not null default now()
);

-- Jouw voortgang per kaart
create table if not exists public.card_progress (
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  card_id       text not null references public.cards (id) on delete cascade,
  known         boolean not null default false,
  times_seen    int not null default 0,
  times_correct int not null default 0,
  updated_at    timestamptz not null default now(),
  primary key (user_id, card_id)
);

-- Uitslagen van quizrondes
create table if not exists public.quiz_results (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  mode       text not null,
  total      int  not null,
  score      int  not null,
  created_at timestamptz not null default now()
);

-- Beveiliging: zonder deze regels kan niemand iets lezen of schrijven
alter table public.cards         enable row level security;
alter table public.card_progress enable row level security;
alter table public.quiz_results  enable row level security;

-- Kaarten: iedereen die is ingelogd mag ze lezen (bewerken doe je in het Supabase-dashboard)
drop policy if exists "kaarten lezen" on public.cards;
create policy "kaarten lezen" on public.cards
  for select to authenticated using (true);

-- Voortgang: je ziet en wijzigt alleen je eigen rijen
drop policy if exists "eigen voortgang" on public.card_progress;
create policy "eigen voortgang" on public.card_progress
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "eigen quizuitslagen" on public.quiz_results;
create policy "eigen quizuitslagen" on public.quiz_results
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
