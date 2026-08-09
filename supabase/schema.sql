-- ============================================================
-- BLOOD REIGN — Supabase Schema
-- Run this FIRST in the Supabase SQL Editor (Project > SQL Editor > New query)
-- Requires: pgcrypto (for gen_random_uuid) — enabled by default on Supabase
-- ============================================================

-- ------------------------------------------------------------
-- 1. PROFILES
-- One row per authenticated user (auth.users). Created automatically
-- by the handle_new_user trigger (see bottom of this file).
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  username            text unique not null,
  ff_uid              text,
  avatar_seed         text default substr(md5(random()::text), 1, 6),
  coins               integer not null default 0,
  total_kills         integer not null default 0,
  total_wins          integer not null default 0,
  tournaments_joined  integer not null default 0,
  current_streak      integer not null default 0,
  last_login_date     date,
  ads_watched_today   integer not null default 0,
  ads_date            date,
  discord_optin       boolean not null default true,
  is_admin            boolean not null default false,
  -- Auto-updated by a client heartbeat (every ~60s while the app is open).
  -- No player-facing toggle — "online" is just last_active_at being recent.
  last_active_at      timestamptz,
  created_at          timestamptz not null default now()
);

comment on table public.profiles is 'Public player profile, 1:1 with auth.users. is_admin must be set manually via the Supabase dashboard for security.';

-- ------------------------------------------------------------
-- 2. TOURNAMENTS
-- ------------------------------------------------------------
create table if not exists public.tournaments (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  mode             text not null check (mode in ('SOLO','DUO','SQUAD')),
  map              text not null,
  prize_label      text not null,           -- e.g. "500 DIAMONDS"
  sponsor          text,
  status           text not null default 'UPCOMING' check (status in ('LIVE','UPCOMING','COMPLETED')),
  max_players      integer not null default 50,
  start_time       timestamptz not null,
  winner_username  text,
  is_grand_final   boolean not null default false,
  created_at       timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 3. TOURNAMENT REGISTRATIONS
-- ------------------------------------------------------------
create table if not exists public.tournament_registrations (
  id             uuid primary key default gen_random_uuid(),
  tournament_id  uuid not null references public.tournaments(id) on delete cascade,
  user_id        uuid not null references public.profiles(id) on delete cascade,
  ff_uid         text not null,
  username       text not null,
  created_at     timestamptz not null default now(),
  unique (tournament_id, user_id)
);

-- ------------------------------------------------------------
-- 4. PRODUCTS (Shop)
-- ------------------------------------------------------------
create table if not exists public.products (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  brand            text not null default 'BLOOD REIGN',
  category         text not null check (category in ('School','Laptop','Ladies','Travel','Saree')),
  price            numeric(10,2) not null,
  rating           numeric(2,1) not null default 4.5,
  tag              text check (tag in ('HOT','NEW', null)),
  gradient_from    text not null default '#1a1a2e',
  gradient_to      text not null default '#2a2a3a',
  image_url        text,
  in_stock         boolean not null default true,
  created_at       timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 5. ORDERS
-- ------------------------------------------------------------
create table if not exists public.orders (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid references public.profiles(id) on delete set null,
  product_id         uuid references public.products(id) on delete set null,
  product_name       text not null,
  price              numeric(10,2) not null,
  coins_used         integer not null default 0,
  discount_pct       integer not null default 0,
  delivery_address   text,
  status             text not null default 'pending' check (status in ('pending','confirmed','shipped','delivered','cancelled')),
  created_at         timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 6. COIN TRANSACTIONS (audit log — only written by RPC functions)
-- ------------------------------------------------------------
create table if not exists public.coin_transactions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  amount         integer not null,           -- positive = earn, negative = redeem
  reason         text not null,
  balance_after  integer not null,
  created_at     timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 7. ANNOUNCEMENTS (home ticker)
-- ------------------------------------------------------------
create table if not exists public.announcements (
  id          uuid primary key default gen_random_uuid(),
  message     text not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 8. BADGES
-- ------------------------------------------------------------
create table if not exists public.badges (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  badge_key   text not null,   -- 'first_tournament' | 'shop_explorer' | 'coin_collector'
  earned_at   timestamptz not null default now(),
  unique (user_id, badge_key)
);

-- ------------------------------------------------------------
-- Helpful indexes
-- ------------------------------------------------------------
create index if not exists idx_tournaments_status on public.tournaments(status);
create index if not exists idx_products_category on public.products(category);
create index if not exists idx_orders_user on public.orders(user_id);
create index if not exists idx_coin_tx_user on public.coin_transactions(user_id);
create index if not exists idx_registrations_tournament on public.tournament_registrations(tournament_id);
create index if not exists idx_profiles_coins on public.profiles(coins desc);
create index if not exists idx_profiles_kills on public.profiles(total_kills desc);

-- ------------------------------------------------------------
-- Auto-create a profile row whenever a new auth user signs up
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', 'Player' || substr(new.id::text, 1, 6))
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Enable Realtime (optional, lets the UI live-update tournaments/coins)
alter publication supabase_realtime add table public.tournaments;
alter publication supabase_realtime add table public.announcements;
