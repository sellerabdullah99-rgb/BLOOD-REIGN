-- ============================================================
-- BLOOD REIGN — RPC Functions
-- Run this THIRD, after schema.sql and policies.sql
-- These run as SECURITY DEFINER so coin balances can never be
-- forged by editing client-side JavaScript.
-- ============================================================

-- ------------------------------------------------------------
-- earn_coins: internal helper, adds coins + writes an audit row
-- ------------------------------------------------------------
create or replace function public._earn_coins(p_user_id uuid, p_amount int, p_reason text)
returns int
language plpgsql
security definer set search_path = public
as $$
declare
  v_new_balance int;
begin
  update public.profiles
    set coins = coins + p_amount
    where id = p_user_id
    returning coins into v_new_balance;

  insert into public.coin_transactions (user_id, amount, reason, balance_after)
    values (p_user_id, p_amount, p_reason, v_new_balance);

  return v_new_balance;
end;
$$;

-- ------------------------------------------------------------
-- watch_ad(): +10 coins, max 5/day, resets at local date change
-- ------------------------------------------------------------
create or replace function public.watch_ad()
returns json
language plpgsql
security definer set search_path = public
as $$
declare
  v_profile   public.profiles%rowtype;
  v_today     date := current_date;
  v_new_bal   int;
begin
  select * into v_profile from public.profiles where id = auth.uid() for update;
  if v_profile is null then
    return json_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  if v_profile.ads_date is distinct from v_today then
    update public.profiles set ads_watched_today = 0, ads_date = v_today where id = auth.uid();
    v_profile.ads_watched_today := 0;
  end if;

  if v_profile.ads_watched_today >= 5 then
    return json_build_object('ok', false, 'error', 'daily_limit_reached', 'ads_watched_today', v_profile.ads_watched_today);
  end if;

  update public.profiles set ads_watched_today = ads_watched_today + 1 where id = auth.uid();
  v_new_bal := public._earn_coins(auth.uid(), 10, 'Watched ad');

  return json_build_object('ok', true, 'coins', v_new_bal, 'ads_watched_today', v_profile.ads_watched_today + 1);
end;
$$;

-- ------------------------------------------------------------
-- claim_daily_login(): +5 coins once per calendar day, tracks streak
-- ------------------------------------------------------------
create or replace function public.claim_daily_login()
returns json
language plpgsql
security definer set search_path = public
as $$
declare
  v_profile  public.profiles%rowtype;
  v_today    date := current_date;
  v_new_bal  int;
  v_streak   int;
begin
  select * into v_profile from public.profiles where id = auth.uid() for update;
  if v_profile is null then
    return json_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  if v_profile.last_login_date = v_today then
    return json_build_object('ok', false, 'error', 'already_claimed', 'streak', v_profile.current_streak);
  end if;

  v_streak := case when v_profile.last_login_date = v_today - 1 then v_profile.current_streak + 1 else 1 end;

  update public.profiles set last_login_date = v_today, current_streak = v_streak where id = auth.uid();
  v_new_bal := public._earn_coins(auth.uid(), 5, 'Daily login');

  return json_build_object('ok', true, 'coins', v_new_bal, 'streak', v_streak);
end;
$$;

-- ------------------------------------------------------------
-- earn_share_bonus(): +15 coins for sharing a tournament (client calls after opening Discord share)
-- ------------------------------------------------------------
create or replace function public.earn_share_bonus()
returns json
language plpgsql
security definer set search_path = public
as $$
declare
  v_new_bal int;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  v_new_bal := public._earn_coins(auth.uid(), 15, 'Shared tournament');
  return json_build_object('ok', true, 'coins', v_new_bal);
end;
$$;

-- ------------------------------------------------------------
-- redeem_reward(): deducts coins for a cosmetic or shop discount
-- ------------------------------------------------------------
create or replace function public.redeem_reward(p_reward_key text, p_cost int)
returns json
language plpgsql
security definer set search_path = public
as $$
declare
  v_balance int;
  v_new_bal int;
begin
  select coins into v_balance from public.profiles where id = auth.uid() for update;
  if v_balance is null then
    return json_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  if v_balance < p_cost then
    return json_build_object('ok', false, 'error', 'insufficient_coins', 'balance', v_balance);
  end if;

  v_new_bal := public._earn_coins(auth.uid(), -p_cost, 'Redeemed: ' || p_reward_key);
  return json_build_object('ok', true, 'coins', v_new_bal);
end;
$$;

-- ------------------------------------------------------------
-- register_for_tournament(): joins a tournament, +100 coins if admin later marks as winner (separate fn)
-- ------------------------------------------------------------
create or replace function public.register_for_tournament(p_tournament_id uuid, p_ff_uid text, p_username text)
returns json
language plpgsql
security definer set search_path = public
as $$
declare
  v_count int;
  v_max   int;
  v_already boolean;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  select exists(
    select 1 from public.tournament_registrations
    where tournament_id = p_tournament_id and user_id = auth.uid()
  ) into v_already;
  if v_already then
    return json_build_object('ok', false, 'error', 'already_registered');
  end if;

  select max_players into v_max from public.tournaments where id = p_tournament_id;
  select count(*) into v_count from public.tournament_registrations where tournament_id = p_tournament_id;

  if v_count >= v_max then
    return json_build_object('ok', false, 'error', 'tournament_full');
  end if;

  insert into public.tournament_registrations (tournament_id, user_id, ff_uid, username)
    values (p_tournament_id, auth.uid(), p_ff_uid, p_username);

  update public.profiles set tournaments_joined = tournaments_joined + 1 where id = auth.uid();

  -- first-tournament badge
  insert into public.badges (user_id, badge_key)
    values (auth.uid(), 'first_tournament')
    on conflict do nothing;

  return json_build_object('ok', true);
end;
$$;

-- ------------------------------------------------------------
-- admin_grant_coins(): admin-only, grants coins to any player by username (e.g. tournament win)
-- ------------------------------------------------------------
create or replace function public.admin_grant_coins(p_username text, p_amount int, p_reason text default 'Admin grant')
returns json
language plpgsql
security definer set search_path = public
as $$
declare
  v_target uuid;
  v_new_bal int;
begin
  if not public.is_admin() then
    return json_build_object('ok', false, 'error', 'not_authorized');
  end if;

  select id into v_target from public.profiles where username = p_username;
  if v_target is null then
    return json_build_object('ok', false, 'error', 'user_not_found');
  end if;

  v_new_bal := public._earn_coins(v_target, p_amount, p_reason);
  return json_build_object('ok', true, 'coins', v_new_bal);
end;
$$;

-- ------------------------------------------------------------
-- admin_set_winner(): admin-only, marks a tournament COMPLETED + winner, grants +100 coins
-- ------------------------------------------------------------
create or replace function public.admin_set_winner(p_tournament_id uuid, p_username text)
returns json
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    return json_build_object('ok', false, 'error', 'not_authorized');
  end if;

  update public.tournaments
    set status = 'COMPLETED', winner_username = p_username
    where id = p_tournament_id;

  update public.profiles set total_wins = total_wins + 1 where username = p_username;

  perform public.admin_grant_coins(p_username, 100, 'Tournament win');

  return json_build_object('ok', true);
end;
$$;

-- ------------------------------------------------------------
-- admin_get_tournament_participants(): admin-only, returns everyone
-- registered for a tournament so kills can be recorded per player.
-- SOLO -> tournament_registrations. DUO/SQUAD -> frozen roster_snapshot
-- on each team's registration (captured at register-team time).
-- ------------------------------------------------------------
create or replace function public.admin_get_tournament_participants(p_tournament_id uuid)
returns json
language plpgsql
security definer set search_path = public
as $$
declare
  v_mode text;
  v_result json;
begin
  if not public.is_admin() then
    return json_build_object('ok', false, 'error', 'not_authorized');
  end if;

  select mode into v_mode from public.tournaments where id = p_tournament_id;
  if v_mode is null then
    return json_build_object('ok', false, 'error', 'tournament_not_found');
  end if;

  if v_mode = 'SOLO' then
    select coalesce(json_agg(json_build_object(
             'profile_id', user_id, 'username', username, 'ign', username
           )), '[]'::json)
      into v_result
      from public.tournament_registrations
      where tournament_id = p_tournament_id;
  else
    select coalesce(json_agg(json_build_object(
             'profile_id', elem->>'profile_id', 'username', elem->>'ign', 'ign', elem->>'ign',
             'team_name', t.name
           )), '[]'::json)
      into v_result
      from public.tournament_team_registrations ttr
      join public.teams t on t.id = ttr.team_id
      cross join lateral jsonb_array_elements(ttr.roster_snapshot) elem
      where ttr.tournament_id = p_tournament_id;
  end if;

  return json_build_object('ok', true, 'mode', v_mode, 'participants', v_result);
end;
$$;

-- ------------------------------------------------------------
-- admin_complete_tournament(): admin-only. Marks a tournament COMPLETED,
-- adds each participant's kills to their profile's total_kills (only for
-- entries with a linked profile_id — unlinked teammates without an app
-- account are skipped), sets the winner, +1 win and +100 coins for them.
-- p_results shape: [{ "profile_id": "uuid-or-null", "kills": 7 }, ...]
-- ------------------------------------------------------------
create or replace function public.admin_complete_tournament(
  p_tournament_id uuid,
  p_results jsonb,
  p_winner_profile_id uuid default null,
  p_winner_username text default null
)
returns json
language plpgsql
security definer set search_path = public
as $$
declare
  v_item jsonb;
  v_winner_username text;
begin
  if not public.is_admin() then
    return json_build_object('ok', false, 'error', 'not_authorized');
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_results, '[]'::jsonb))
  loop
    if (v_item->>'profile_id') is not null and (v_item->>'kills') is not null then
      update public.profiles
        set total_kills = total_kills + greatest((v_item->>'kills')::int, 0)
        where id = (v_item->>'profile_id')::uuid;
    end if;
  end loop;

  if p_winner_profile_id is not null then
    select username into v_winner_username from public.profiles where id = p_winner_profile_id;
  else
    v_winner_username := p_winner_username;
  end if;

  update public.tournaments
    set status = 'COMPLETED', winner_username = v_winner_username
    where id = p_tournament_id;

  if v_winner_username is not null then
    update public.profiles set total_wins = total_wins + 1 where username = v_winner_username;
    perform public.admin_grant_coins(v_winner_username, 100, 'Tournament win');
  end if;

  return json_build_object('ok', true);
end;
$$;
