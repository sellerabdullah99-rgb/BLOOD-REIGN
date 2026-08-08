/* ==========================================================
   BLOOD REIGN — Auth
   Exposes one normalized profile shape to the rest of the app,
   regardless of whether Supabase is configured (real accounts)
   or not (local guest identity). Fires 'br:profile-changed' on
   document whenever the profile updates, so UI can re-render.
   ========================================================== */

window.BR = window.BR || {};

BR.auth = (function () {
  let session = null;
  let profile = null; // normalized shape, see _normalizeFromSupabase / guestStore

  function _normalizeFromSupabase(row) {
    return {
      mode: 'live',
      id: row.id,
      username: row.username,
      ff_uid: row.ff_uid || '',
      ign: row.ign || '',
      primary_role: row.primary_role || '',
      coins: row.coins,
      total_kills: row.total_kills,
      total_wins: row.total_wins,
      tournaments_joined: row.tournaments_joined,
      current_streak: row.current_streak,
      is_admin: row.is_admin,
      discord_optin: row.discord_optin,
    };
  }

  function _normalizeFromGuest(state) {
    return {
      mode: 'guest',
      id: null,
      username: state.username || 'Guest Warrior',
      ff_uid: state.ff_uid || '',
      ign: state.ign || '',
      primary_role: state.role || '',
      coins: state.coins,
      total_kills: state.total_kills,
      total_wins: state.total_wins,
      tournaments_joined: state.tournaments_joined,
      current_streak: state.current_streak,
      is_admin: false,
      discord_optin: state.discord_optin,
    };
  }

  async function refreshProfile() {
    if (BR.isConfigured && session) {
      const { data, error } = await BR.sb.from('profiles').select('*').eq('id', session.user.id).single();
      if (!error && data) profile = _normalizeFromSupabase(data);
    } else {
      profile = _normalizeFromGuest(BR.guestStore.get());
    }
    document.dispatchEvent(new CustomEvent('br:profile-changed', { detail: profile }));
    return profile;
  }

  async function init() {
    if (BR.isConfigured) {
      const { data } = await BR.sb.auth.getSession();
      session = data.session;
      BR.sb.auth.onAuthStateChange(async (_event, newSession) => {
        session = newSession;
        await refreshProfile();
      });
    } else {
      // Local guest mode: mirror guestStore changes into the unified profile
      document.addEventListener('br:profile-changed', (e) => {
        if (e.detail && e.detail.mode) return; // already normalized, avoid loop
      });
    }
    await refreshProfile();
    return profile;
  }

  function isLoggedIn() {
    return BR.isConfigured ? !!session : !!(profile && profile.username && profile.username !== 'Guest Warrior');
  }

  function getProfile() {
    return profile;
  }

  async function signUp(email, password, username, extra = {}) {
    if (!BR.isConfigured) return { ok: false, error: 'Supabase not configured — using guest mode.' };
    const { ign, ffUid, role } = extra;
    const { data, error } = await BR.sb.auth.signUp({
      email, password,
      options: { data: { username, ign: ign || '', ff_uid: ffUid || '', role: role || '' } },
    });
    if (error) return { ok: false, error: error.message };
    session = data.session;
    await refreshProfile();
    return { ok: true };
  }

  async function signIn(email, password) {
    if (!BR.isConfigured) return { ok: false, error: 'Supabase not configured — using guest mode.' };
    const { data, error } = await BR.sb.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, error: error.message };
    session = data.session;
    await refreshProfile();
    return { ok: true };
  }

  async function signOut() {
    if (BR.isConfigured) await BR.sb.auth.signOut();
    session = null;
    await refreshProfile();
  }

  function setGuestIdentity(username, ff_uid) {
    BR.guestStore.setIdentity(username, ff_uid);
    return refreshProfile();
  }

  async function updateProfileFields(fields) {
    if (BR.isConfigured && session) {
      const { error } = await BR.sb.from('profiles').update(fields).eq('id', session.user.id);
      if (error) return { ok: false, error: error.message };
      await refreshProfile();
      return { ok: true };
    } else {
      const st = BR.guestStore.get();
      if (fields.username !== undefined) st.username = fields.username;
      if (fields.ff_uid !== undefined) st.ff_uid = fields.ff_uid;
      if (fields.ign !== undefined) st.ign = fields.ign;
      if (fields.primary_role !== undefined) st.role = fields.primary_role;
      if (fields.discord_optin !== undefined) st.discord_optin = fields.discord_optin;
      BR.guestStore.save(st);
      await refreshProfile();
      return { ok: true };
    }
  }

  return {
    init, isLoggedIn, getProfile, refreshProfile,
    signUp, signIn, signOut, setGuestIdentity, updateProfileFields,
    get session() { return session; },
  };
})();
