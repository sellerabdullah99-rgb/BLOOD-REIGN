-- ============================================================
-- BLOOD REIGN — Teams & Roster RLS
-- Run this AFTER teams_schema.sql
-- ============================================================

alter table public.teams                         enable row level security;
alter table public.team_members                   enable row level security;
alter table public.tournament_team_registrations   enable row level security;
alter table public.tryouts                         enable row level security;
alter table public.tryout_applications             enable row level security;
alter table public.scrims                          enable row level security;

-- Helper: is the current user the captain of this team?
create or replace function public.is_team_captain(p_team_id uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.teams where id = p_team_id and captain_id = auth.uid()
  );
$$;

-- ------------------------------------------------------------
-- TEAMS — public read (rosters are public, like a real org site);
-- captain or admin can update/delete; any signed-in user can create one.
-- ------------------------------------------------------------
create policy "teams are publicly readable"
  on public.teams for select using (true);

create policy "signed in users create a team"
  on public.teams for insert
  with check (auth.uid() = captain_id);

create policy "captain or admin updates team"
  on public.teams for update
  using (auth.uid() = captain_id or public.is_admin());

create policy "captain or admin deletes team"
  on public.teams for delete
  using (auth.uid() = captain_id or public.is_admin());

-- ------------------------------------------------------------
-- TEAM MEMBERS — public read; only the team's captain (or admin) writes
-- ------------------------------------------------------------
create policy "team members are publicly readable"
  on public.team_members for select using (true);

create policy "captain manages roster"
  on public.team_members for all
  using (public.is_team_captain(team_id) or public.is_admin())
  with check (public.is_team_captain(team_id) or public.is_admin());

-- ------------------------------------------------------------
-- TOURNAMENT TEAM REGISTRATIONS — public read; only the captain
-- of the registering team can insert; admin can manage
-- ------------------------------------------------------------
create policy "team registrations are publicly readable"
  on public.tournament_team_registrations for select using (true);

create policy "captain registers own team"
  on public.tournament_team_registrations for insert
  with check (public.is_team_captain(team_id) and registered_by = auth.uid());

create policy "admin manages team registrations"
  on public.tournament_team_registrations for delete
  using (public.is_admin());

-- ------------------------------------------------------------
-- TRYOUTS — public read; only captain (or admin) posts/closes
-- ------------------------------------------------------------
create policy "tryouts are publicly readable"
  on public.tryouts for select using (true);

create policy "captain manages own tryouts"
  on public.tryouts for all
  using (public.is_team_captain(team_id) or public.is_admin())
  with check (public.is_team_captain(team_id) or public.is_admin());

-- ------------------------------------------------------------
-- TRYOUT APPLICATIONS — applicant reads/creates their own;
-- the tryout's team captain reads & responds to applications for it
-- ------------------------------------------------------------
create policy "applicant reads own application"
  on public.tryout_applications for select
  using (
    applicant_id = auth.uid()
    or public.is_admin()
    or exists (select 1 from public.tryouts t where t.id = tryout_id and public.is_team_captain(t.team_id))
  );

create policy "user applies to a tryout"
  on public.tryout_applications for insert
  with check (applicant_id = auth.uid());

create policy "captain responds to applications"
  on public.tryout_applications for update
  using (exists (select 1 from public.tryouts t where t.id = tryout_id and public.is_team_captain(t.team_id)) or public.is_admin());

-- ------------------------------------------------------------
-- SCRIMS — public read (so opponents/fans can see the schedule);
-- only host captain (or admin) writes
-- ------------------------------------------------------------
create policy "scrims are publicly readable"
  on public.scrims for select using (true);

create policy "host captain manages own scrims"
  on public.scrims for all
  using (public.is_team_captain(host_team_id) or public.is_admin())
  with check (public.is_team_captain(host_team_id) or public.is_admin());
