-- ============================================================
-- BLOOD REIGN — Teams & Roster RPC Functions
-- Run this AFTER teams_schema.sql + teams_policies.sql
-- ============================================================

-- ------------------------------------------------------------
-- create_team(): creates a team and seats the creator as
-- captain + first roster member in one step.
-- ------------------------------------------------------------
create or replace function public.create_team(
  p_name text, p_tag text,
  p_captain_full_name text, p_captain_ign text, p_captain_ff_uid text, p_captain_role text
)
returns json
language plpgsql
security definer set search_path = public
as $$
declare
  v_team_id uuid;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  insert into public.teams (name, tag, captain_id)
    values (p_name, upper(p_tag), auth.uid())
    returning id into v_team_id;

  insert into public.team_members (team_id, profile_id, full_name, ign, ff_uid, role, is_captain)
    values (v_team_id, auth.uid(), p_captain_full_name, p_captain_ign, p_captain_ff_uid, p_captain_role, true);

  return json_build_object('ok', true, 'team_id', v_team_id);
exception
  when unique_violation then
    return json_build_object('ok', false, 'error', 'tag_taken');
end;
$$;

-- ------------------------------------------------------------
-- add_team_member(): captain adds a roster slot. Capped at 6
-- (4 starters + 2 subs) to keep rosters realistic.
-- ------------------------------------------------------------
create or replace function public.add_team_member(
  p_team_id uuid, p_full_name text, p_ign text, p_ff_uid text, p_role text
)
returns json
language plpgsql
security definer set search_path = public
as $$
declare
  v_count int;
begin
  if not public.is_team_captain(p_team_id) and not public.is_admin() then
    return json_build_object('ok', false, 'error', 'not_authorized');
  end if;

  select count(*) into v_count from public.team_members where team_id = p_team_id;
  if v_count >= 6 then
    return json_build_object('ok', false, 'error', 'roster_full');
  end if;

  insert into public.team_members (team_id, full_name, ign, ff_uid, role)
    values (p_team_id, p_full_name, p_ign, p_ff_uid, p_role);

  return json_build_object('ok', true);
exception
  when unique_violation then
    return json_build_object('ok', false, 'error', 'ign_taken_on_team');
end;
$$;

-- ------------------------------------------------------------
-- register_team_for_tournament(): validates roster size against
-- the tournament's mode, freezes a roster snapshot, and credits
-- every linked member's tournament count.
-- ------------------------------------------------------------
create or replace function public.register_team_for_tournament(p_tournament_id uuid, p_team_id uuid)
returns json
language plpgsql
security definer set search_path = public
as $$
declare
  v_mode text;
  v_max int;
  v_reg_count int;
  v_roster jsonb;
  v_roster_size int;
  v_min_needed int;
begin
  if not public.is_team_captain(p_team_id) then
    return json_build_object('ok', false, 'error', 'not_authorized');
  end if;

  select mode, max_players into v_mode, v_max from public.tournaments where id = p_tournament_id;
  if v_mode is null then
    return json_build_object('ok', false, 'error', 'tournament_not_found');
  end if;
  if v_mode = 'SOLO' then
    return json_build_object('ok', false, 'error', 'solo_tournament_use_individual_join');
  end if;

  v_min_needed := case when v_mode = 'DUO' then 2 else 4 end;

  select jsonb_agg(jsonb_build_object('profile_id', profile_id, 'full_name', full_name, 'ign', ign, 'role', role))
    into v_roster
    from public.team_members where team_id = p_team_id;
  v_roster_size := coalesce(jsonb_array_length(v_roster), 0);

  if v_roster_size < v_min_needed then
    return json_build_object('ok', false, 'error', 'roster_too_small', 'need', v_min_needed, 'have', v_roster_size);
  end if;

  select count(*) into v_reg_count from public.tournament_team_registrations where tournament_id = p_tournament_id;
  if v_reg_count >= v_max then
    return json_build_object('ok', false, 'error', 'tournament_full');
  end if;

  if exists(
    select 1 from public.tournament_team_registrations
    where tournament_id = p_tournament_id and team_id = p_team_id
  ) then
    return json_build_object('ok', false, 'error', 'already_registered');
  end if;

  insert into public.tournament_team_registrations (tournament_id, team_id, registered_by, roster_snapshot)
    values (p_tournament_id, p_team_id, auth.uid(), v_roster);

  update public.profiles set tournaments_joined = tournaments_joined + 1
    where id in (select profile_id from public.team_members where team_id = p_team_id and profile_id is not null);

  insert into public.badges (user_id, badge_key)
    select profile_id, 'first_tournament' from public.team_members
    where team_id = p_team_id and profile_id is not null
    on conflict do nothing;

  return json_build_object('ok', true);
end;
$$;

-- ------------------------------------------------------------
-- admin_schedule_tryout(): creates a PLANNED tryout — a scheduled trial
-- with one specific registered player (not an open "anyone can apply"
-- posting). Shows up as "Team X trial with <player> at <time>".
-- ------------------------------------------------------------
create or replace function public.admin_schedule_tryout(
  p_team_id uuid, p_profile_id uuid, p_role text, p_scheduled_time timestamptz, p_notes text default null
)
returns json
language plpgsql
security definer set search_path = public
as $$
declare
  v_username text;
  v_id uuid;
begin
  if not public.is_admin() then
    return json_build_object('ok', false, 'error', 'not_authorized');
  end if;

  select username into v_username from public.profiles where id = p_profile_id;
  if v_username is null then
    return json_build_object('ok', false, 'error', 'player_not_found');
  end if;

  insert into public.tryouts (team_id, role_needed, description, status, target_profile_id, scheduled_time)
    values (p_team_id, p_role, coalesce(p_notes, ''), 'OPEN', p_profile_id, p_scheduled_time)
    returning id into v_id;

  return json_build_object('ok', true, 'tryout_id', v_id, 'username', v_username);
end;
$$;

-- ------------------------------------------------------------
-- admin_add_registered_player_to_team(): lets the admin pick any
-- registered (logged-in) user by profile and drop them straight into a
-- team's roster, linked by profile_id (so kills/stats track correctly).
-- ------------------------------------------------------------
create or replace function public.admin_add_registered_player_to_team(
  p_team_id uuid, p_profile_id uuid, p_role text
)
returns json
language plpgsql
security definer set search_path = public
as $$
declare
  v_count int;
  v_username text;
  v_ff_uid text;
begin
  if not public.is_admin() then
    return json_build_object('ok', false, 'error', 'not_authorized');
  end if;

  select username, ff_uid into v_username, v_ff_uid from public.profiles where id = p_profile_id;
  if v_username is null then
    return json_build_object('ok', false, 'error', 'player_not_found');
  end if;

  select count(*) into v_count from public.team_members where team_id = p_team_id;
  if v_count >= 6 then
    return json_build_object('ok', false, 'error', 'roster_full');
  end if;

  insert into public.team_members (team_id, profile_id, full_name, ign, ff_uid, role)
    values (p_team_id, p_profile_id, v_username, v_username, v_ff_uid, p_role)
    on conflict (team_id, ign) do nothing;

  return json_build_object('ok', true, 'username', v_username);
end;
$$;

-- ------------------------------------------------------------
-- respond_to_tryout(): captain accepts or rejects an application.
-- Accepting auto-adds the applicant to the roster and closes the tryout.
-- ------------------------------------------------------------
create or replace function public.respond_to_tryout(p_application_id uuid, p_status text)
returns json
language plpgsql
security definer set search_path = public
as $$
declare
  v_app        public.tryout_applications%rowtype;
  v_tryout     public.tryouts%rowtype;
  v_add_result json;
begin
  if p_status not in ('ACCEPTED','REJECTED') then
    return json_build_object('ok', false, 'error', 'invalid_status');
  end if;

  select * into v_app from public.tryout_applications where id = p_application_id;
  if v_app is null then
    return json_build_object('ok', false, 'error', 'application_not_found');
  end if;

  select * into v_tryout from public.tryouts where id = v_app.tryout_id;
  if not public.is_team_captain(v_tryout.team_id) and not public.is_admin() then
    return json_build_object('ok', false, 'error', 'not_authorized');
  end if;

  update public.tryout_applications set status = p_status where id = p_application_id;

  if p_status = 'ACCEPTED' then
    insert into public.team_members (team_id, profile_id, full_name, ign, ff_uid, role)
      values (v_tryout.team_id, v_app.applicant_id, v_app.full_name, v_app.ign, v_app.ff_uid, v_tryout.role_needed)
      on conflict (team_id, ign) do nothing;
    update public.tryouts set status = 'CLOSED' where id = v_tryout.id;
  end if;

  return json_build_object('ok', true);
end;
$$;
