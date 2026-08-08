/* ==========================================================
   BLOOD REIGN — Supabase Client
   Loads the Supabase JS SDK (UMD, from CDN — see index.html) and
   creates a single shared client. If the keys in config.js haven't
   been filled in yet, BR.isConfigured is false and the app falls
   back to local mock data so the UI still works out of the box.
   ========================================================== */

window.BR = window.BR || {};

(function () {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = BR.config;

  BR.isConfigured = !!(
    SUPABASE_URL && SUPABASE_ANON_KEY &&
    !SUPABASE_URL.includes('YOUR_SUPABASE') &&
    !SUPABASE_ANON_KEY.includes('YOUR_SUPABASE')
  );

  if (BR.isConfigured && window.supabase) {
    BR.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
  } else {
    BR.sb = null;
    console.warn(
      '[BLOOD REIGN] Supabase is not configured yet — running on local mock data.\n' +
      'Add your project URL + anon key to js/config.js to go live.'
    );
  }
})();
