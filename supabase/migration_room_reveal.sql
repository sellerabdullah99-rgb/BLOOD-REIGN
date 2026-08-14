-- ==========================================================
-- BLOOD REIGN — Migration: Room Reveal feature
-- Safe to run multiple times (idempotent). Only adds what's new —
-- does not touch any existing tables/policies/data.
-- ==========================================================

-- 1. Add the reveal-time column to tournaments (if missing)
alter table public.tournaments add column if not exists room_reveal_time timestamptz;

-- 2. Create the tournament_rooms table (if missing)
create table if not exists public.tournament_rooms (
  tournament_id  uuid primary key references public.tournaments(id) on delete cascade,
  room_id        text,
  room_password  text,
  updated_at     timestamptz not null default now()
);

-- 3. Enable RLS on it
alter table public.tournament_rooms enable row level security;

-- 4. (Re)create the policies — drop first so this is safe to re-run
drop policy if exists "room credentials visible only after reveal time" on public.tournament_rooms;
create policy "room credentials visible only after reveal time"
  on public.tournament_rooms for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.tournaments t
      where t.id = tournament_rooms.tournament_id
        and t.room_reveal_time is not null
        and now() >= t.room_reveal_time
    )
  );

drop policy if exists "admins manage room credentials" on public.tournament_rooms;
create policy "admins manage room credentials"
  on public.tournament_rooms for all
  using (public.is_admin())
  with check (public.is_admin());
