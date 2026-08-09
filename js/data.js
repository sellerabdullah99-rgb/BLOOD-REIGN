/* ==========================================================
   BLOOD REIGN — Data Access Layer
   Every UI module calls BR.data.* only. This file decides whether
   to hit Supabase or fall back to local mock/guest data, so the
   rest of the app never has to know which mode it's in.
   ========================================================== */

window.BR = window.BR || {};

BR.data = (function () {
  const { ls } = BR.utils;
  const ADMIN_LOCAL_KEY = 'bloodreign_admin_local';

  function _adminLocal() {
    return ls.get(ADMIN_LOCAL_KEY, {
      addedTournaments: [], deletedTournamentIds: [], winnerOverrides: {},
      orders: [], addedAnnouncements: [], coinGrants: [],
    });
  }
  function _saveAdminLocal(s) { ls.set(ADMIN_LOCAL_KEY, s); }

  // ---------------------------------------------------------
  // TOURNAMENTS
  // ---------------------------------------------------------
  async function getTournaments() {
    if (BR.isConfigured) {
      const { data, error } = await BR.sb
        .from('tournaments')
        .select('*, registrations:tournament_registrations(count)')
        .order('start_time', { ascending: true });
      if (error) { console.error(error); return []; }
      return data.map(t => ({ ...t, current_players: t.registrations?.[0]?.count || 0 }));
    }
    const local = _adminLocal();
    const merged = [...BR.mockData.tournaments, ...local.addedTournaments]
      .filter(t => !local.deletedTournamentIds.includes(t.id))
      .map(t => local.winnerOverrides[t.id]
        ? { ...t, status: 'COMPLETED', winner_username: local.winnerOverrides[t.id] }
        : t);
    return merged;
  }

  async function registerForTournament(tournamentId, ffUid, username) {
    if (BR.isConfigured) {
      const { data, error } = await BR.sb.rpc('register_for_tournament', {
        p_tournament_id: tournamentId, p_ff_uid: ffUid, p_username: username,
      });
      if (error) return { ok: false, error: error.message };
      return data;
    }
    return BR.guestStore.registerForTournament(tournamentId, ffUid, username);
  }

  function isRegistered(tournamentId) {
    // Live mode: caller should check registrations returned with the tournament, or track client-side per session.
    if (!BR.isConfigured) return BR.guestStore.isRegistered(tournamentId);
    return false;
  }

  // Returns { [tournamentId]: { type: 'solo'|'team', label } } for every
  // tournament the current user (solo) or their team has already joined —
  // used to show "already registered" and stop a second join.
  async function getMyRegistrations() {
    const result = {};
    if (BR.isConfigured) {
      const { data: userData } = await BR.sb.auth.getUser();
      const uid = userData?.user?.id;
      if (!uid) return result;

      const { data: solo } = await BR.sb.from('tournament_registrations')
        .select('tournament_id, username').eq('user_id', uid);
      (solo || []).forEach(r => { result[r.tournament_id] = { type: 'solo', label: `You're in as ${r.username}` }; });

      const { data: memberships } = await BR.sb.from('team_members').select('team_id').eq('profile_id', uid);
      const teamIds = [...new Set((memberships || []).map(m => m.team_id))];
      if (teamIds.length) {
        const { data: teamRegs } = await BR.sb.from('tournament_team_registrations')
          .select('tournament_id, teams(name)').in('team_id', teamIds);
        (teamRegs || []).forEach(r => {
          result[r.tournament_id] = { type: 'team', label: `${r.teams?.name || 'Your team'} is registered` };
        });
      }
      return result;
    }
    // Demo/local mode
    const guest = BR.guestStore.get();
    (guest.registrations || []).forEach(id => {
      result[id] = { type: 'solo', label: `You're in as ${guest.username || 'Guest Warrior'}` };
    });
    const myTeam = BR.teamStore.getMyTeam();
    if (myTeam) {
      const local = _adminLocal();
      const allIds = [...BR.mockData.tournaments, ...local.addedTournaments].map(t => t.id);
      allIds.forEach(id => {
        if (BR.teamStore.isRegisteredForTournament(id)) {
          result[id] = { type: 'team', label: `${myTeam.name} is registered` };
        }
      });
    }
    return result;
  }

  // ---------------------------------------------------------
  // PRODUCTS
  // ---------------------------------------------------------
  async function getProducts(category, search) {
    if (BR.isConfigured) {
      let q = BR.sb.from('products').select('*').order('created_at', { ascending: false });
      if (category && category !== 'All') q = q.eq('category', category);
      if (search) q = q.ilike('name', `%${search}%`);
      const { data, error } = await q;
      if (error) { console.error(error); return []; }
      return data;
    }
    let items = BR.mockData.products;
    if (category && category !== 'All') items = items.filter(p => p.category === category);
    if (search) items = items.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
    return items;
  }

  // ---------------------------------------------------------
  // ANNOUNCEMENTS
  // ---------------------------------------------------------
  async function getAnnouncements() {
    if (BR.isConfigured) {
      const { data, error } = await BR.sb.from('announcements').select('message').eq('active', true).order('created_at', { ascending: false });
      if (error) { console.error(error); return []; }
      return data.map(a => a.message);
    }
    const local = _adminLocal();
    return [...local.addedAnnouncements, ...BR.mockData.announcements];
  }

  async function publishAnnouncement(message) {
    if (BR.isConfigured) {
      const { error } = await BR.sb.from('announcements').insert({ message });
      return error ? { ok: false, error: error.message } : { ok: true };
    }
    const local = _adminLocal();
    local.addedAnnouncements.unshift(message);
    _saveAdminLocal(local);
    return { ok: true };
  }

  // ---------------------------------------------------------
  // LEADERBOARD
  // Note: "This week" vs "All time" both read the same live totals here.
  // A true weekly leaderboard needs a scheduled snapshot/reset job —
  // see README for the recommended approach when you're ready for that.
  // ---------------------------------------------------------
  async function getLeaderboard() {
    if (BR.isConfigured) {
      const { data, error } = await BR.sb
        .from('profiles').select('username, total_kills, total_wins, coins')
        .order('total_kills', { ascending: false }).limit(20);
      if (error) { console.error(error); return []; }
      return data;
    }
    return BR.mockData.leaderboard;
  }

  // ---------------------------------------------------------
  // COIN ECONOMY (delegates to secure RPCs when live)
  // ---------------------------------------------------------
  async function watchAd() {
    if (BR.isConfigured) {
      const { data, error } = await BR.sb.rpc('watch_ad');
      if (error) return { ok: false, error: error.message };
      return data;
    }
    return BR.guestStore.watchAd();
  }

  async function claimDailyLogin() {
    if (BR.isConfigured) {
      const { data, error } = await BR.sb.rpc('claim_daily_login');
      if (error) return { ok: false, error: error.message };
      return data;
    }
    return BR.guestStore.claimDailyLogin();
  }

  async function earnShareBonus() {
    if (BR.isConfigured) {
      const { data, error } = await BR.sb.rpc('earn_share_bonus');
      if (error) return { ok: false, error: error.message };
      return data;
    }
    return BR.guestStore.earnShareBonus();
  }

  async function redeemReward(key, cost, label) {
    if (BR.isConfigured) {
      const { data, error } = await BR.sb.rpc('redeem_reward', { p_reward_key: key, p_cost: cost });
      if (error) return { ok: false, error: error.message };
      return data;
    }
    return BR.guestStore.redeemReward(key, cost, label);
  }

  async function getCoinTransactions() {
    if (BR.isConfigured && BR.auth.session) {
      const { data, error } = await BR.sb
        .from('coin_transactions').select('*')
        .eq('user_id', BR.auth.session.user.id)
        .order('created_at', { ascending: false }).limit(10);
      if (error) { console.error(error); return []; }
      return data;
    }
    return BR.guestStore.get().transactions;
  }

  // ---------------------------------------------------------
  // ORDERS
  // ---------------------------------------------------------
  async function createOrder(order) {
    const record = {
      product_id: order.productId, product_name: order.productName, price: order.price,
      coins_used: order.coinsUsed || 0, discount_pct: order.discountPct || 0,
      delivery_address: order.deliveryAddress || null,
    };
    if (BR.isConfigured) {
      const payload = { ...record, user_id: BR.auth.session ? BR.auth.session.user.id : null };
      const { error } = await BR.sb.from('orders').insert(payload);
      return error ? { ok: false, error: error.message } : { ok: true };
    }
    const local = _adminLocal();
    local.orders.unshift({ id: 'o' + Date.now(), status: 'pending', created_at: new Date().toISOString(), ...record });
    _saveAdminLocal(local);
    return { ok: true };
  }

  async function getOrders() {
    if (BR.isConfigured) {
      const { data, error } = await BR.sb.from('orders').select('*').order('created_at', { ascending: false });
      if (error) { console.error(error); return []; }
      return data;
    }
    return _adminLocal().orders;
  }

  async function updateOrderStatus(orderId, status) {
    if (BR.isConfigured) {
      const { error } = await BR.sb.from('orders').update({ status }).eq('id', orderId);
      return error ? { ok: false, error: error.message } : { ok: true };
    }
    const local = _adminLocal();
    const o = local.orders.find(o => o.id === orderId);
    if (o) { o.status = status; _saveAdminLocal(local); }
    return { ok: true };
  }

  // ---------------------------------------------------------
  // ADMIN — tournaments
  // ---------------------------------------------------------
  async function adminCreateTournament(t) {
    if (BR.isConfigured) {
      const { error } = await BR.sb.from('tournaments').insert(t);
      return error ? { ok: false, error: error.message } : { ok: true };
    }
    const local = _adminLocal();
    local.addedTournaments.unshift({ id: 'admin_' + Date.now(), current_players: 0, winner_username: null, ...t });
    _saveAdminLocal(local);
    return { ok: true };
  }

  async function adminDeleteTournament(id) {
    if (BR.isConfigured) {
      // .select() forces Supabase to return the deleted row(s). If RLS
      // silently blocks the delete (e.g. is_admin isn't set), no error is
      // thrown but zero rows come back — that's the real failure signal.
      const { data, error } = await BR.sb.from('tournaments').delete().eq('id', id).select();
      if (error) return { ok: false, error: error.message };
      if (!data || data.length === 0) {
        return { ok: false, error: 'Nothing deleted — your account may not have is_admin set in Supabase.' };
      }
      return { ok: true };
    }
    const local = _adminLocal();
    local.deletedTournamentIds.push(id);
    _saveAdminLocal(local);
    return { ok: true };
  }

  async function adminSetWinner(tournamentId, username) {
    if (BR.isConfigured) {
      const { data, error } = await BR.sb.rpc('admin_set_winner', { p_tournament_id: tournamentId, p_username: username });
      if (error) return { ok: false, error: error.message };
      return data;
    }
    const local = _adminLocal();
    local.winnerOverrides[tournamentId] = username;
    _saveAdminLocal(local);
    return { ok: true };
  }

  // Returns everyone registered for a tournament (SOLO registrants, or
  // DUO/SQUAD roster members via the frozen roster snapshot) so the admin
  // can enter each player's kills before marking it complete.
  async function adminGetTournamentParticipants(tournamentId) {
    if (BR.isConfigured) {
      const { data, error } = await BR.sb.rpc('admin_get_tournament_participants', { p_tournament_id: tournamentId });
      if (error) return { ok: false, error: error.message, participants: [] };
      return data;
    }
    // Local/demo mode has no shared backend, so other players' registrations
    // aren't visible here — the admin UI falls back to manual name entry.
    return { ok: true, participants: [] };
  }

  // Adds each participant's kills to their total_kills, sets the winner
  // (+1 win, +100 coins), and marks the tournament COMPLETED.
  // results: [{ profile_id, username, kills }]
  async function adminCompleteTournament(tournamentId, results, winner) {
    if (BR.isConfigured) {
      const { data, error } = await BR.sb.rpc('admin_complete_tournament', {
        p_tournament_id: tournamentId,
        p_results: results.map(r => ({ profile_id: r.profile_id || null, kills: r.kills || 0 })),
        p_winner_profile_id: winner?.profile_id || null,
        p_winner_username: winner?.profile_id ? null : (winner?.username || null),
      });
      if (error) return { ok: false, error: error.message };
      return data;
    }
    // Demo mode: no cross-user profiles to update, but if the current guest
    // is one of the listed participants, credit their own kills locally.
    const me = BR.auth.getProfile();
    const mine = results.find(r => me && r.username && r.username === me.username);
    if (mine && mine.kills) {
      const st = BR.guestStore.get();
      st.total_kills = (st.total_kills || 0) + mine.kills;
      BR.guestStore.save(st);
    }
    const local = _adminLocal();
    if (winner?.username) local.winnerOverrides[tournamentId] = winner.username;
    _saveAdminLocal(local);
    return { ok: true };
  }

  // ---------------------------------------------------------
  // ADMIN — coins
  // ---------------------------------------------------------
  async function adminGrantCoins(username, amount, reason) {
    if (BR.isConfigured) {
      const { data, error } = await BR.sb.rpc('admin_grant_coins', { p_username: username, p_amount: amount, p_reason: reason || 'Admin grant' });
      if (error) return { ok: false, error: error.message };
      return data;
    }
    const local = _adminLocal();
    local.coinGrants.unshift({ username, amount, reason: reason || 'Admin grant', created_at: new Date().toISOString() });
    _saveAdminLocal(local);
    return { ok: true, note: 'Recorded locally — connect Supabase for real cross-device coin grants.' };
  }

  function getCoinGrantLog() {
    return _adminLocal().coinGrants;
  }

  // ---------------------------------------------------------
  // ADMIN — analytics (lightweight, computed client-side)
  // ---------------------------------------------------------
  async function getAnalytics() {
    const [tournaments, orders, leaderboard] = await Promise.all([getTournaments(), getOrders(), getLeaderboard()]);
    const weekAgo = Date.now() - 7 * 86400000;
    const ordersThisWeek = orders.filter(o => new Date(o.created_at).getTime() >= weekAgo);
    const revenueThisWeek = ordersThisWeek.reduce((sum, o) => sum + Number(o.price) * (1 - (o.discount_pct || 0) / 100), 0);

    const productCounts = {};
    orders.forEach(o => { productCounts[o.product_name] = (productCounts[o.product_name] || 0) + 1; });
    const topProduct = Object.entries(productCounts).sort((a, b) => b[1] - a[1])[0];

    const mostJoined = [...tournaments].sort((a, b) => (b.current_players || 0) - (a.current_players || 0))[0];

    return {
      totalPlayers: leaderboard.length,
      totalTournaments: tournaments.length,
      liveTournaments: tournaments.filter(t => t.status === 'LIVE').length,
      totalOrders: orders.length,
      revenueThisWeek,
      topProduct: topProduct ? { name: topProduct[0], count: topProduct[1] } : null,
      mostJoinedTournament: mostJoined || null,
    };
  }

  // ---------------------------------------------------------
  // TEAMS / ROSTER
  // ---------------------------------------------------------
  async function getMyTeam() {
    if (BR.isConfigured && BR.auth.session) {
      const { data: team, error } = await BR.sb.from('teams').select('*').eq('captain_id', BR.auth.session.user.id).maybeSingle();
      if (error || !team) return null;
      const { data: members } = await BR.sb.from('team_members').select('*').eq('team_id', team.id).order('is_captain', { ascending: false });
      return { ...team, members: members || [] };
    }
    return BR.teamStore.getMyTeam();
  }

  async function createTeam(name, tag, captain) {
    if (BR.isConfigured) {
      const { data, error } = await BR.sb.rpc('create_team', {
        p_name: name, p_tag: tag,
        p_captain_full_name: captain.fullName, p_captain_ign: captain.ign,
        p_captain_ff_uid: captain.ffUid, p_captain_role: captain.role,
      });
      if (error) return { ok: false, error: error.message };
      return data;
    }
    return BR.teamStore.createTeam(name, tag, captain);
  }

  async function addTeamMember(teamId, fullName, ign, ffUid, role) {
    if (BR.isConfigured) {
      const { data, error } = await BR.sb.rpc('add_team_member', { p_team_id: teamId, p_full_name: fullName, p_ign: ign, p_ff_uid: ffUid, p_role: role });
      if (error) return { ok: false, error: error.message };
      return data;
    }
    return BR.teamStore.addMember(fullName, ign, ffUid, role);
  }

  async function removeTeamMember(memberId, teamId) {
    if (BR.isConfigured) {
      const { error } = await BR.sb.from('team_members').delete().eq('id', memberId);
      return error ? { ok: false, error: error.message } : { ok: true };
    }
    return BR.teamStore.removeMember(memberId);
  }

  async function registerTeamForTournament(tournament, teamId) {
    if (BR.isConfigured) {
      const { data, error } = await BR.sb.rpc('register_team_for_tournament', { p_tournament_id: tournament.id, p_team_id: teamId });
      if (error) return { ok: false, error: error.message };
      return data;
    }
    return BR.teamStore.registerForTournament(tournament);
  }

  async function isTeamRegistered(tournamentId, teamId) {
    if (BR.isConfigured) {
      const { data } = await BR.sb.from('tournament_team_registrations').select('id').eq('tournament_id', tournamentId).eq('team_id', teamId).maybeSingle();
      return !!data;
    }
    return BR.teamStore.isRegisteredForTournament(tournamentId);
  }

  // ---------------------------------------------------------
  // TRYOUTS
  // ---------------------------------------------------------
  async function getOpenTryouts() {
    if (BR.isConfigured) {
      const { data, error } = await BR.sb.from('tryouts').select('*, teams(name, tag)').eq('status', 'OPEN').order('created_at', { ascending: false });
      if (error) { console.error(error); return []; }
      return data.map(t => ({ ...t, team_name: t.teams?.name, team_tag: t.teams?.tag }));
    }
    return BR.teamStore.getTryouts().filter(t => t.status === 'OPEN');
  }

  async function createTryout(teamId, roleNeeded, description) {
    if (BR.isConfigured) {
      const { error } = await BR.sb.from('tryouts').insert({ team_id: teamId, role_needed: roleNeeded, description });
      return error ? { ok: false, error: error.message } : { ok: true };
    }
    return BR.teamStore.createTryout(roleNeeded, description);
  }

  async function closeTryout(tryoutId) {
    if (BR.isConfigured) {
      const { error } = await BR.sb.from('tryouts').update({ status: 'CLOSED' }).eq('id', tryoutId);
      return error ? { ok: false, error: error.message } : { ok: true };
    }
    return BR.teamStore.closeTryout(tryoutId);
  }

  async function applyToTryout(tryoutId, fullName, ign, ffUid, message) {
    if (BR.isConfigured) {
      const { error } = await BR.sb.from('tryout_applications').insert({
        tryout_id: tryoutId, applicant_id: BR.auth.session?.user.id, full_name: fullName, ign, ff_uid: ffUid, message,
      });
      return error ? { ok: false, error: error.message } : { ok: true };
    }
    return BR.teamStore.applyToTryout(tryoutId, fullName, ign, ffUid, message);
  }

  async function getMyTeamApplications(teamId) {
    if (BR.isConfigured) {
      const { data, error } = await BR.sb.from('tryout_applications').select('*, tryouts!inner(team_id, role_needed)').eq('tryouts.team_id', teamId).order('created_at', { ascending: false });
      if (error) { console.error(error); return []; }
      return data;
    }
    const tryouts = BR.teamStore.getTryouts();
    return tryouts.flatMap(t => BR.teamStore.getApplications(t.id));
  }

  async function respondToTryout(applicationId, status) {
    if (BR.isConfigured) {
      const { data, error } = await BR.sb.rpc('respond_to_tryout', { p_application_id: applicationId, p_status: status });
      if (error) return { ok: false, error: error.message };
      return data;
    }
    return BR.teamStore.respondToTryout(applicationId, status);
  }

  // ---------------------------------------------------------
  // SCRIMS
  // ---------------------------------------------------------
  async function getUpcomingScrims() {
    if (BR.isConfigured) {
      const { data, error } = await BR.sb.from('scrims').select('*, teams:host_team_id(name, tag)').order('scheduled_time', { ascending: true });
      if (error) { console.error(error); return []; }
      return data.map(s => ({ ...s, host_team_name: s.teams?.name }));
    }
    return BR.teamStore.getScrims();
  }

  async function scheduleScrim(teamId, details) {
    if (BR.isConfigured) {
      const { error } = await BR.sb.from('scrims').insert({
        host_team_id: teamId, opponent_name: details.opponentName, map: details.map,
        mode: details.mode, scheduled_time: details.scheduledTime, notes: details.notes,
      });
      return error ? { ok: false, error: error.message } : { ok: true };
    }
    return BR.teamStore.scheduleScrim(details);
  }

  async function updateScrimStatus(scrimId, status, result) {
    if (BR.isConfigured) {
      const { error } = await BR.sb.from('scrims').update({ status, result }).eq('id', scrimId);
      return error ? { ok: false, error: error.message } : { ok: true };
    }
    return BR.teamStore.updateScrimStatus(scrimId, status, result);
  }

  async function deleteScrim(scrimId) {
    if (BR.isConfigured) {
      const { error } = await BR.sb.from('scrims').delete().eq('id', scrimId);
      return error ? { ok: false, error: error.message } : { ok: true };
    }
    return BR.teamStore.deleteScrim(scrimId);
  }

  return {
    getTournaments, registerForTournament, isRegistered, getMyRegistrations,
    getProducts, getAnnouncements, publishAnnouncement, getLeaderboard,
    watchAd, claimDailyLogin, earnShareBonus, redeemReward, getCoinTransactions,
    createOrder, getOrders, updateOrderStatus,
    adminCreateTournament, adminDeleteTournament, adminSetWinner,
    adminGetTournamentParticipants, adminCompleteTournament,
    adminGrantCoins, getCoinGrantLog, getAnalytics,
    getMyTeam, createTeam, addTeamMember, removeTeamMember, registerTeamForTournament, isTeamRegistered,
    getOpenTryouts, createTryout, closeTryout, applyToTryout, getMyTeamApplications, respondToTryout,
    getUpcomingScrims, scheduleScrim, updateScrimStatus, deleteScrim,
  };
})();