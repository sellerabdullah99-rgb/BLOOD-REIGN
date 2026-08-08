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

  // Returns { mode: 'SOLO'|'DUO'|'SQUAD', players: [{username, ff_uid}], teams: [{name, tag, roster}] }
  // so a tournament card can show everyone who has joined so far — not just "you".
  async function getTournamentParticipants(tournament) {
    if (BR.isConfigured) {
      if (tournament.mode === 'SOLO') {
        const { data, error } = await BR.sb
          .from('tournament_registrations').select('username, ff_uid, created_at')
          .eq('tournament_id', tournament.id).order('created_at', { ascending: true });
        if (error) { console.error(error); return { mode: tournament.mode, players: [], teams: [] }; }
        return { mode: tournament.mode, players: data, teams: [] };
      }
      const { data, error } = await BR.sb
        .from('tournament_team_registrations').select('roster_snapshot, created_at, teams(name, tag, region)')
        .eq('tournament_id', tournament.id).order('created_at', { ascending: true });
      if (error) { console.error(error); return { mode: tournament.mode, players: [], teams: [] }; }
      return { mode: tournament.mode, players: [], teams: data.map(r => ({ name: r.teams?.name, tag: r.teams?.tag, region: r.teams?.region, roster: r.roster_snapshot || [] })) };
    }

    // Demo mode: seed data + whatever the current guest/local team has registered
    const seed = BR.mockData.tournamentParticipants?.[tournament.id] || { players: [], teams: [] };
    const players = [...(seed.players || [])];
    const teams = [...(seed.teams || [])];

    if (tournament.mode === 'SOLO') {
      if (BR.guestStore.isRegistered(tournament.id)) {
        const g = BR.guestStore.get();
        if (g.username && !players.some(p => p.username === g.username)) players.push({ username: g.username, ff_uid: g.ff_uid });
      }
    } else {
      if (BR.teamStore.isRegisteredForTournament(tournament.id)) {
        const t = BR.teamStore.getMyTeam();
        if (t && !teams.some(x => x.tag === t.tag)) {
          teams.push({ name: t.name, tag: t.tag, region: t.region, roster: t.members.map(m => ({ ign: m.ign, role: m.role })) });
        }
      }
    }
    return { mode: tournament.mode, players, teams };
  }

  // ---------------------------------------------------------
  // ALL TEAMS (public directory — used by Scrims/Tryouts "Browse Teams")
  // ---------------------------------------------------------
  async function getAllTeams() {
    if (BR.isConfigured) {
      const { data, error } = await BR.sb
        .from('teams').select('*, team_members(ign, role, is_captain)')
        .order('created_at', { ascending: false });
      if (error) { console.error(error); return []; }
      return data.map(t => ({ ...t, members: t.team_members || [] }));
    }
    const local = BR.teamStore.getMyTeam();
    const seeded = BR.mockData.teams.map(t => ({ ...t }));
    if (local && !seeded.some(t => t.tag === local.tag)) {
      seeded.unshift({ id: local.id, name: local.name, tag: local.tag, region: local.region, members: local.members.map(m => ({ ign: m.ign, role: m.role })) });
    }
    return seeded;
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
      const { error } = await BR.sb.from('tournaments').delete().eq('id', id);
      return error ? { ok: false, error: error.message } : { ok: true };
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
    getTournaments, registerForTournament, isRegistered, getTournamentParticipants, getAllTeams,
    getProducts, getAnnouncements, publishAnnouncement, getLeaderboard,
    watchAd, claimDailyLogin, earnShareBonus, redeemReward, getCoinTransactions,
    createOrder, getOrders, updateOrderStatus,
    adminCreateTournament, adminDeleteTournament, adminSetWinner,
    adminGrantCoins, getCoinGrantLog, getAnalytics,
    getMyTeam, createTeam, addTeamMember, removeTeamMember, registerTeamForTournament, isTeamRegistered,
    getOpenTryouts, createTryout, closeTryout, applyToTryout, getMyTeamApplications, respondToTryout,
    getUpcomingScrims, scheduleScrim, updateScrimStatus, deleteScrim,
  };
})();
