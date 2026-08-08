/* ==========================================================
   BLOOD REIGN — Guest Store
   Used when Supabase isn't configured (or user hasn't signed in yet).
   Mirrors the rules in supabase/functions.sql exactly so app
   behavior is identical whether running live or locally.
   ========================================================== */

window.BR = window.BR || {};

BR.guestStore = (function () {
  const { ls, todayStr } = BR.utils;
  const KEY = 'bloodreign_guest_state';

  function defaultState() {
    return {
      username: '', ff_uid: '',
      coins: 0,
      total_kills: 0, total_wins: 0,
      tournaments_joined: 0,
      current_streak: 0,
      last_login_date: null,
      ads_watched_today: 0, ads_date: null,
      discord_optin: true,
      is_admin: false,
      transactions: [],   // { amount, reason, balance_after, created_at }
      registrations: [],  // tournament_id list
      badges: [],         // badge_key list
    };
  }

  function get() {
    return ls.get(KEY, defaultState());
  }

  function save(state) {
    ls.set(KEY, state);
    document.dispatchEvent(new CustomEvent('br:profile-changed', { detail: state }));
    return state;
  }

  function _earn(state, amount, reason) {
    state.coins += amount;
    state.transactions.unshift({ amount, reason, balance_after: state.coins, created_at: new Date().toISOString() });
    state.transactions = state.transactions.slice(0, 10);
    return state;
  }

  function setIdentity(username, ff_uid) {
    const state = get();
    state.username = username;
    state.ff_uid = ff_uid;
    return save(state);
  }

  function watchAd() {
    const state = get();
    const today = todayStr();
    if (state.ads_date !== today) { state.ads_date = today; state.ads_watched_today = 0; }
    if (state.ads_watched_today >= 5) return { ok: false, error: 'daily_limit_reached' };
    state.ads_watched_today += 1;
    _earn(state, 10, 'Watched ad');
    save(state);
    return { ok: true, coins: state.coins, ads_watched_today: state.ads_watched_today };
  }

  function claimDailyLogin() {
    const state = get();
    const today = todayStr();
    if (state.last_login_date === today) return { ok: false, error: 'already_claimed', streak: state.current_streak };
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    state.current_streak = state.last_login_date === yesterday ? state.current_streak + 1 : 1;
    state.last_login_date = today;
    _earn(state, 5, 'Daily login');
    save(state);
    return { ok: true, coins: state.coins, streak: state.current_streak };
  }

  function earnShareBonus() {
    const state = get();
    _earn(state, 15, 'Shared tournament');
    save(state);
    return { ok: true, coins: state.coins };
  }

  function redeemReward(key, cost, label) {
    const state = get();
    if (state.coins < cost) return { ok: false, error: 'insufficient_coins', balance: state.coins };
    _earn(state, -cost, `Redeemed: ${label || key}`);
    save(state);
    return { ok: true, coins: state.coins };
  }

  function registerForTournament(tournamentId, ffUid, username) {
    const state = get();
    if (state.registrations.includes(tournamentId)) return { ok: true, alreadyJoined: true };
    state.registrations.push(tournamentId);
    state.tournaments_joined += 1;
    state.ff_uid = ffUid || state.ff_uid;
    state.username = username || state.username;
    if (!state.badges.includes('first_tournament')) state.badges.push('first_tournament');
    save(state);
    return { ok: true };
  }

  function isRegistered(tournamentId) {
    return get().registrations.includes(tournamentId);
  }

  function markShopVisited() {
    const state = get();
    if (!state.badges.includes('shop_explorer')) {
      state.badges.push('shop_explorer');
      save(state);
    }
  }

  return {
    get, save, setIdentity, watchAd, claimDailyLogin, earnShareBonus,
    redeemReward, registerForTournament, isRegistered, markShopVisited,
  };
})();
