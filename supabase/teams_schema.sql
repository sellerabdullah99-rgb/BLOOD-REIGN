-- ============================================================
-- BLOOD REIGN — Teams & Roster Schema (extension)
-- Run this AFTER schema.sql + policies.sql + functions.sql + seed.sql
-- Adds: team rosters, squad tournament registration, tryouts, scrims,
-- and richer announcements (title/category/pinned).
-- ============================================================

-- ------------------------------------------------------------
-- 1. TEAMS
-- ------------------------------------------------------------
create table if not exists public.teams (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  tag          text not null,             -- short clan tag, e.g. "BR"
  captain_id   uuid references public.profiles(id) on delete set null,
  logo_seed    text default substr(md5(random()::text), 1, 6),
  region       text not null default 'Pakistan',
  bio          text,
  created_at   timestamptz not null default now(),
  unique (tag)
);

-- ------------------------------------------------------------
-- 2. TEAM MEMBERS (roster)
-- Roles match Free Fire squad composition: IGL, Rusher, Assaulter,
-- Sniper, plus Support/Substitute for flexibility.
-- profile_id is nullable so a captain can pencil in a member's
-- details before that player has (or links) an account.
-- ------------------------------------------------------------
create table if not exists public.team_members (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.teams(id) on delete cascade,
  profile_id  uuid references public.profiles(id) on delete set null,
  full_name   text not null,
  ign         text not null,               -- in-game name
  ff_uid      text,
  role        text not null check (role in ('IGL','RUSHER','ASSAULTER','SNIPER','SUPPORT','SUBSTITUTE')),
  is_captain  boolean not null default false,
  joined_at   timestamptz not null default now(),
  unique (team_id, ign)
);

-- ------------------------------------------------------------
-- 3. TOURNAMENT TEAM REGISTRATIONS
-- Used for DUO/SQUAD tournaments. roster_snapshot freezes the
-- roster at registration time so later roster changes don't
-- rewrite tournament history.
-- ------------------------------------------------------------
create table if not exists public.tournament_team_registrations (
  id                uuid primary key default gen_random_uuid(),
  tournament_id     uuid not null references public.tournaments(id) on delete cascade,
  team_id           uuid not null references public.teams(id) on delete cascade,
  registered_by     uuid references public.profiles(id),
  roster_snapshot   jsonb not null,        -- [{full_name, ign, role}, ...]
  created_at        timestamptz not null default now(),
  unique (tournament_id, team_id)
);

-- ------------------------------------------------------------
-- 4. TRYOUTS — open roster slots a captain posts
-- ------------------------------------------------------------
create table if not exists public.tryouts (
  id                uuid primary key default gen_random_uuid(),
  team_id           uuid not null references public.teams(id) on delete cascade,
  role_needed       text not null check (role_needed in ('IGL','RUSHER','ASSAULTER','SNIPER','SUPPORT','SUBSTITUTE')),
  description       text,
  status            text not null default 'OPEN' check (status in ('OPEN','CLOSED')),
  -- Planned/1-on-1 tryout fields (set by admin's "Schedule Tryout" tool):
  -- when target_profile_id is set, this is a scheduled trial with that
  -- specific registered player rather than an open role posting anyone can apply to.
  target_profile_id uuid references public.profiles(id) on delete set null,
  scheduled_time     timestamptz,
  created_at        timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 5. TRYOUT APPLICATIONS
-- ------------------------------------------------------------
create table if not exists public.tryout_applications (
  id             uuid primary key default gen_random_uuid(),
  tryout_id      uuid not null references public.tryouts(id) on delete cascade,
  applicant_id   uuid not null references public.profiles(id) on delete cascade,
  full_name      text not null,
  ign            text not null,
  ff_uid         text,
  message        text,
  status         text not null default 'PENDING' check (status in ('PENDING','ACCEPTED','REJECTED')),
  created_at     timestamptz not null default now(),
  unique (tryout_id, applicant_id)
);

-- ------------------------------------------------------------
-- 6. SCRIMS — practice matches, scheduled by a team captain
-- ------------------------------------------------------------
create table if not exists public.scrims (
  id                 uuid primary key default gen_random_uuid(),
  host_team_id       uuid not null references public.teams(id) on delete cascade,
  opponent_team_id   uuid references public.teams(id) on delete set null,
  opponent_name      text,                 -- freeform, used if opponent isn't on the platform
  map                text,
  mode               text check (mode in ('SOLO','DUO','SQUAD')),
  scheduled_time     timestamptz not null,
  status             text not null default 'SCHEDULED' check (status in ('SCHEDULED','COMPLETED','CANCELLED')),
  result             text,
  notes              text,
  created_at         timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 7. Richer announcements (title / category / pinned)
-- ------------------------------------------------------------
alter table public.announcements add column if not exists title text;
alter table public.announcements add column if not exists category text not null default 'general'
  check (category in ('general','tournament','scrim','tryout'));
alter table public.announcements add column if not exists pinned boolean not null default false;

-- ------------------------------------------------------------
-- Indexes
-- ------------------------------------------------------------
create index if not exists idx_team_members_team on public.team_members(team_id);
create index if not exists idx_team_members_profile on public.team_members(profile_id);
create index if not exists idx_ttr_tournament on public.tournament_team_registrations(tournament_id);
create index if not exists idx_ttr_team on public.tournament_team_registrations(team_id);
create index if not exists idx_tryouts_team on public.tryouts(team_id);
create index if not exists idx_tryouts_status on public.tryouts(status);
create index if not exists idx_tryout_apps_tryout on public.tryout_applications(tryout_id);
create index if not exists idx_scrims_host on public.scrims(host_team_id);
create index if not exists idx_scrims_time on public.scrims(scheduled_time);

alter publication supabase_realtime add table public.scrims;
alter publication supabase_realtime add table public.tryouts;
