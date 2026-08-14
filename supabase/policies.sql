-- ============================================================
-- BLOOD REIGN — Row Level Security (RLS)
-- Run this SECOND, after schema.sql
-- ============================================================

alter table public.profiles                enable row level security;
alter table public.tournaments              enable row level security;
alter table public.tournament_registrations enable row level security;
alter table public.products                 enable row level security;
alter table public.orders                   enable row level security;
alter table public.coin_transactions        enable row level security;
alter table public.announcements            enable row level security;
alter table public.badges                   enable row level security;

-- Small helper: is the current user an admin?
create or replace function public.is_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- ------------------------------------------------------------
-- PROFILES
-- Public leaderboard needs to read everyone; users edit only themselves.
-- ------------------------------------------------------------
create policy "profiles are publicly readable"
  on public.profiles for select
  using (true);

create policy "users update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id and is_admin = (select is_admin from public.profiles where id = auth.uid())); -- can't self-promote to admin

create policy "admins update any profile"
  on public.profiles for update
  using (public.is_admin());

-- ------------------------------------------------------------
-- TOURNAMENTS — public read, admin write
-- ------------------------------------------------------------
create policy "tournaments are publicly readable"
  on public.tournaments for select
  using (true);

create policy "admins manage tournaments"
  on public.tournaments for all
  using (public.is_admin())
  with check (public.is_admin());

-- ------------------------------------------------------------
-- TOURNAMENT ROOMS — genuinely hidden (not just UI-hidden) until
-- room_reveal_time passes. A select query simply returns 0 rows for
-- non-admins before that time — the app never even receives the values.
-- ------------------------------------------------------------
alter table public.tournament_rooms enable row level security;

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

create policy "admins manage room credentials"
  on public.tournament_rooms for all
  using (public.is_admin())
  with check (public.is_admin());
  with check (public.is_admin());

-- ------------------------------------------------------------
-- REGISTRATIONS — users see/create their own, admins see all
-- ------------------------------------------------------------
create policy "users read own registrations"
  on public.tournament_registrations for select
  using (auth.uid() = user_id or public.is_admin());

create policy "users register themselves"
  on public.tournament_registrations for insert
  with check (auth.uid() = user_id);

create policy "admins manage registrations"
  on public.tournament_registrations for delete
  using (public.is_admin());

-- ------------------------------------------------------------
-- PRODUCTS — public read, admin write
-- ------------------------------------------------------------
create policy "products are publicly readable"
  on public.products for select
  using (true);

create policy "admins manage products"
  on public.products for all
  using (public.is_admin())
  with check (public.is_admin());

-- ------------------------------------------------------------
-- ORDERS — users see/create their own, admins see & update all
-- ------------------------------------------------------------
create policy "users read own orders"
  on public.orders for select
  using (auth.uid() = user_id or public.is_admin());

create policy "users create own orders"
  on public.orders for insert
  with check (auth.uid() = user_id or user_id is null);

create policy "admins update orders"
  on public.orders for update
  using (public.is_admin());

-- ------------------------------------------------------------
-- COIN TRANSACTIONS — read-only audit log for the owner
-- (rows are only ever written by SECURITY DEFINER functions, see functions.sql)
-- ------------------------------------------------------------
create policy "users read own coin transactions"
  on public.coin_transactions for select
  using (auth.uid() = user_id or public.is_admin());

-- ------------------------------------------------------------
-- ANNOUNCEMENTS — public read, admin write
-- ------------------------------------------------------------
create policy "announcements are publicly readable"
  on public.announcements for select
  using (active = true or public.is_admin());

create policy "admins manage announcements"
  on public.announcements for all
  using (public.is_admin())
  with check (public.is_admin());

-- ------------------------------------------------------------
-- BADGES — users read their own, system/admin grants
-- ------------------------------------------------------------
create policy "users read own badges"
  on public.badges for select
  using (auth.uid() = user_id or public.is_admin());

create policy "admins grant badges"
  on public.badges for insert
  with check (public.is_admin());
