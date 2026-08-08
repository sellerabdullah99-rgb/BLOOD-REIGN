/* ==========================================================
   BLOOD REIGN — Main
   Boot sequence: auth (so profile exists) -> nav -> each tab
   module renders itself once and subscribes to the events it
   cares about (br:profile-changed, br:tab-changed, br:data-refresh).
   ========================================================== */

(async function () {
  const { $ } = BR.utils;

  function updateHeaderCoinChip(profile) {
    const el = $('#headerCoinChip');
    if (el && profile) el.textContent = profile.coins.toLocaleString();
  }

  async function boot() {
    await BR.auth.init();
    document.addEventListener('br:profile-changed', (e) => updateHeaderCoinChip(e.detail));
    updateHeaderCoinChip(BR.auth.getProfile());

    BR.nav.init();
    BR.home.init();
    BR.tournaments.init();
    BR.teams.init();
    BR.scrims.init();
    BR.tryouts.init();
    BR.shop.init();
    BR.coins.init();
    BR.leaderboard.init();
    BR.profile.init();
    BR.admin.init();

    // Auto-claim daily login bonus once per day, silently in the background
    const res = await BR.data.claimDailyLogin();
    if (res.ok) {
      BR.utils.toast(`Daily bonus +5 coins! ${res.streak} day streak 🔥`, 'success');
      await BR.auth.refreshProfile();
    }

    document.getElementById('appLoader')?.remove();
  }

  boot();
})();
