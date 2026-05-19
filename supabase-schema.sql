-- ============================================================
-- eFootball Tournaments – Database Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- TABLES
-- ============================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  avatar_url text,
  created_at timestamptz default now()
);

create table if not exists public.tournaments (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  slug text unique not null,
  format text not null check (format in ('league','knockout')),
  status text not null default 'draft' check (status in ('draft','active','completed')),
  max_players int not null default 8,
  description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.players (
  id uuid primary key default uuid_generate_v4(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  name text not null,
  avatar_url text,
  photo_data_url text,
  created_at timestamptz default now()
);

create table if not exists public.fixtures (
  id uuid primary key default uuid_generate_v4(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  home_player_id uuid not null references public.players(id) on delete cascade,
  away_player_id uuid not null references public.players(id) on delete cascade,
  round int not null default 1,
  leg int not null default 1,
  home_score int,
  away_score int,
  status text not null default 'pending' check (status in ('pending','completed')),
  played_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists public.standings (
  id uuid primary key default uuid_generate_v4(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  played int not null default 0,
  won int not null default 0,
  drawn int not null default 0,
  lost int not null default 0,
  goals_for int not null default 0,
  goals_against int not null default 0,
  goal_difference int generated always as (goals_for - goals_against) stored,
  points int not null default 0,
  unique(tournament_id, player_id)
);

-- ============================================================
-- INDEXES
-- ============================================================

create index if not exists idx_tournaments_owner on public.tournaments(owner_id);
create index if not exists idx_tournaments_slug on public.tournaments(slug);
create index if not exists idx_players_tournament on public.players(tournament_id);
create index if not exists idx_fixtures_tournament on public.fixtures(tournament_id);
create index if not exists idx_fixtures_status on public.fixtures(status);
create index if not exists idx_standings_tournament on public.standings(tournament_id);
create index if not exists idx_standings_points on public.standings(tournament_id, points desc);

-- ============================================================
-- AUTH TRIGGER – auto-create profile on signup
-- ============================================================

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles(id, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- updated_at trigger
-- ============================================================

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_tournaments_updated_at on public.tournaments;
create trigger set_tournaments_updated_at
  before update on public.tournaments
  for each row execute function public.set_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.profiles enable row level security;
alter table public.tournaments enable row level security;
alter table public.players enable row level security;
alter table public.fixtures enable row level security;
alter table public.standings enable row level security;

-- profiles
create policy "profiles: public read" on public.profiles
  for select using (true);
create policy "profiles: owner update" on public.profiles
  for update using (auth.uid() = id);

-- tournaments
create policy "tournaments: public read" on public.tournaments
  for select using (true);
create policy "tournaments: owner insert" on public.tournaments
  for insert with check (auth.uid() = owner_id);
create policy "tournaments: owner update" on public.tournaments
  for update using (auth.uid() = owner_id);
create policy "tournaments: owner delete" on public.tournaments
  for delete using (auth.uid() = owner_id);

-- players
create policy "players: public read" on public.players
  for select using (true);
create policy "players: tournament owner insert" on public.players
  for insert with check (
    exists (select 1 from public.tournaments t where t.id = tournament_id and t.owner_id = auth.uid())
  );
create policy "players: tournament owner update" on public.players
  for update using (
    exists (select 1 from public.tournaments t where t.id = tournament_id and t.owner_id = auth.uid())
  );
create policy "players: tournament owner delete" on public.players
  for delete using (
    exists (select 1 from public.tournaments t where t.id = tournament_id and t.owner_id = auth.uid())
  );

-- fixtures
create policy "fixtures: public read" on public.fixtures
  for select using (true);
create policy "fixtures: tournament owner insert" on public.fixtures
  for insert with check (
    exists (select 1 from public.tournaments t where t.id = tournament_id and t.owner_id = auth.uid())
  );
create policy "fixtures: tournament owner update" on public.fixtures
  for update using (
    exists (select 1 from public.tournaments t where t.id = tournament_id and t.owner_id = auth.uid())
  );
create policy "fixtures: tournament owner delete" on public.fixtures
  for delete using (
    exists (select 1 from public.tournaments t where t.id = tournament_id and t.owner_id = auth.uid())
  );

-- standings
create policy "standings: public read" on public.standings
  for select using (true);
create policy "standings: tournament owner manage" on public.standings
  for all using (
    exists (select 1 from public.tournaments t where t.id = tournament_id and t.owner_id = auth.uid())
  );
