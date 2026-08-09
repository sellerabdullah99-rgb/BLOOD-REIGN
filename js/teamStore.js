/* ==========================================================
   BLOOD REIGN — Team Store (local fallback)
   Used only when Supabase isn't configured. Teams are inherently
   multi-user data, so this is a single-browser sandbox: it lets
   you create ONE team and try the roster/tryout/scrim flows
   end-to-end, clearly local-only. Connect Supabase for real,
   cross-device team management.
   ========================================================== */

window.BR = window.BR || {};

BR.teamStore = (function () {
  const { ls } = BR.utils;
  const KEY = 'bloodreign_team_local';

  function _state() {
    return ls.get(KEY, { team: null, tryouts: [], scrims: [], applications: [], registrations: [] });
  }
  function _save(s) { ls.set(KEY, s); }

  function getMyTeam() {
    return _state().team;
  }

  function createTeam(name, tag, captain) {
    const s = _state();
    if (s.team) return { ok: false, error: 'already_have_team' };
    s.team = {
      id: 'team_local', name, tag: tag.toUpperCase(), region: 'Pakistan', bio: '',
      members: [{ id: 'm_' + Date.now(), full_name: captain.fullName, ign: captain.ign, ff_uid: captain.ffUid, role: captain.role, is_captain: true }],
    };
    _save(s);
    return { ok: true };
  }

  function addMember(fullName, ign, ffUid, role) {
    const s = _state();
    if (!s.team) return { ok: false, error: 'no_team' };
    if (s.team.members.length >= 6) return { ok: false, error: 'roster_full' };
    if (s.team.members.some(m => m.ign.toLowerCase() === ign.toLowerCase())) return { ok: false, error: 'ign_taken_on_team' };
    s.team.members.push({ id: 'm_' + Date.now(), full_name: fullName, ign, ff_uid: ffUid, role, is_captain: false });
    _save(s);
    return { ok: true };
  }

  function removeMember(memberId) {
    const s = _state();
    if (!s.team) return { ok: false, error: 'no_team' };
    s.team.members = s.team.members.filter(m => m.id !== memberId);
    _save(s);
    return { ok: true };
  }

  function registerForTournament(tournament) {
    const s = _state();
    if (!s.team) return { ok: false, error: 'no_team' };
    if (tournament.mode === 'SOLO') return { ok: false, error: 'solo_tournament_use_individual_join' };
    const minNeeded = tournament.mode === 'DUO' ? 2 : 4;
    if (s.team.members.length < minNeeded) return { ok: false, error: 'roster_too_small', need: minNeeded, have: s.team.members.length };
    if (s.registrations.includes(tournament.id)) return { ok: true, alreadyJoined: true };
    s.registrations.push(tournament.id);
    _save(s);
    return { ok: true };
  }

  function isRegisteredForTournament(tournamentId) {
    return _state().registrations.includes(tournamentId);
  }

  // ---- Tryouts ----
  function getTryouts() {
    return _state().tryouts;
  }

  function createTryout(roleNeeded, description) {
    const s = _state();
    if (!s.team) return { ok: false, error: 'no_team' };
    s.tryouts.unshift({
      id: 'tryout_' + Date.now(), team_id: s.team.id, team_name: s.team.name, team_tag: s.team.tag,
      role_needed: roleNeeded, description, status: 'OPEN', created_at: new Date().toISOString(),
    });
    _save(s);
    return { ok: true };
  }

  function closeTryout(tryoutId) {
    const s = _state();
    const t = s.tryouts.find(t => t.id === tryoutId);
    if (t) { t.status = 'CLOSED'; _save(s); }
    return { ok: true };
  }

  function applyToTryout(tryoutId, fullName, ign, ffUid, message) {
    const s = _state();
    s.applications.unshift({
      id: 'app_' + Date.now(), tryout_id: tryoutId, full_name: fullName, ign, ff_uid: ffUid, message,
      status: 'PENDING', created_at: new Date().toISOString(),
    });
    _save(s);
    return { ok: true };
  }

  function getApplications(tryoutId) {
    return _state().applications.filter(a => a.tryout_id === tryoutId);
  }

  function respondToTryout(applicationId, status) {
    const s = _state();
    const app = s.applications.find(a => a.id === applicationId);
    if (!app) return { ok: false, error: 'application_not_found' };
    app.status = status;
    if (status === 'ACCEPTED' && s.team) {
      const tryout = s.tryouts.find(t => t.id === app.tryout_id);
      s.team.members.push({ id: 'm_' + Date.now(), full_name: app.full_name, ign: app.ign, ff_uid: app.ff_uid, role: tryout ? tryout.role_needed : 'SUBSTITUTE', is_captain: false });
      if (tryout) tryout.status = 'CLOSED';
    }
    _save(s);
    return { ok: true };
  }

  // ---- Scrims ----
  function getScrims() {
    return _state().scrims;
  }

  function scheduleScrim({ opponentName, map, mode, scheduledTime, notes }) {
    const s = _state();
    if (!s.team) return { ok: false, error: 'no_team' };
    s.scrims.unshift({
      id: 'scrim_' + Date.now(), host_team_id: s.team.id, host_team_name: s.team.name,
      opponent_name: opponentName, map, mode, scheduled_time: scheduledTime, notes,
      status: 'SCHEDULED', result: null, created_at: new Date().toISOString(),
    });
    _save(s);
    return { ok: true };
  }

  function updateScrimStatus(scrimId, status, result) {
    const s = _state();
    const scrim = s.scrims.find(sc => sc.id === scrimId);
    if (scrim) { scrim.status = status; if (result !== undefined) scrim.result = result; _save(s); }
    return { ok: true };
  }

  function deleteScrim(scrimId) {
    const s = _state();
    s.scrims = s.scrims.filter(sc => sc.id !== scrimId);
    _save(s);
    return { ok: true };
  }

  return {
    getMyTeam, createTeam, addMember, removeMember,
    registerForTournament, isRegisteredForTournament,
    getTryouts, createTryout, closeTryout, applyToTryout, getApplications, respondToTryout,
    getScrims, scheduleScrim, updateScrimStatus, deleteScrim,
  };
})();
