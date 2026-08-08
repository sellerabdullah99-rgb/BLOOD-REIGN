/* ==========================================================
   BLOOD REIGN — Home Tab
   ========================================================== */

window.BR = window.BR || {};

BR.home = (function () {
  const { $, formatPKR, formatCompact, countdownString, starString, escapeHtml } = BR.utils;
  let countdownTimers = [];

  function clearTimers() { countdownTimers.forEach(clearInterval); countdownTimers = []; }

  function renderTicker(messages) {
    const track = $('#tickerTrack');
    if (!track) return;
    const text = messages.join('   •   ');
    track.innerHTML = `<span>${text}</span><span aria-hidden="true">${text}</span>`;
  }

  function renderFeatured(tournament) {
    const el = $('#featuredTournament');
    if (!el) return;
    if (!tournament) { el.innerHTML = '<div class="empty-state"><i class="fa-solid fa-trophy"></i><h3>No live tournament right now</h3><p>Check the Tournaments tab for upcoming ones.</p></div>'; return; }
    el.innerHTML = `
      <div class="card card-glow featured-card">
        <div class="featured-top">
          <span class="badge badge-live"><i class="fa-solid fa-circle" style="font-size:6px"></i> LIVE NOW</span>
          <span class="badge badge-green">✅ FREE ENTRY</span>
        </div>
        <h3 class="featured-name">${escapeHtml(tournament.name)}</h3>
        <div class="featured-meta">
          <span class="pill-mode pill-${tournament.mode.toLowerCase()}">${escapeHtml(tournament.mode)}</span>
          <span class="muted"><i class="fa-solid fa-map-location-dot"></i> ${escapeHtml(tournament.map)}</span>
        </div>
        <div class="featured-prize">💎 ${escapeHtml(tournament.prize_label)}</div>
        <button class="btn btn-primary btn-block" data-join-tournament="${tournament.id}">
          <i class="fa-brands fa-discord"></i> JOIN NOW
        </button>
      </div>`;
    el.querySelector('[data-join-tournament]').addEventListener('click', () => BR.tournaments.openJoinModal(tournament));
  }

  function renderTodaysTournaments(list) {
    const el = $('#homeTournamentsRow');
    if (!el) return;
    if (!list.length) { el.innerHTML = '<div class="empty-state"><p>No tournaments yet.</p></div>'; return; }
    el.innerHTML = list.slice(0, 6).map(t => BR.tournaments.cardHTML(t, { compact: true })).join('');
    BR.tournaments.wireCardButtons(el);
  }

  function renderHotBags(list) {
    const el = $('#homeShopRow');
    if (!el) return;
    if (!list.length) { el.innerHTML = '<div class="empty-state"><p>No products yet.</p></div>'; return; }
    el.innerHTML = list.slice(0, 6).map(p => BR.shop.cardHTML(p, { compact: true })).join('');
    BR.shop.wireCardButtons(el);
  }

  function renderTopPlayers(list) {
    const el = $('#homeLeaderboardMini');
    if (!el) return;
    const medals = ['🥇', '🥈', '🥉'];
    el.innerHTML = list.slice(0, 3).map((p, i) => `
      <div class="mini-lb-row">
        <span class="mini-lb-rank">${medals[i]}</span>
        <span class="avatar" style="width:32px;height:32px;font-size:12px">${BR.utils.initials(p.username)}</span>
        <span class="mini-lb-name">${p.username}</span>
        <span class="mini-lb-kills">${formatCompact(p.total_kills)} kills</span>
      </div>`).join('');
  }

  function animateStat(el, target, suffix = '') {
    const duration = 1200;
    const start = performance.now();
    function tick(now) {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(target * eased).toLocaleString() + suffix;
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  async function render() {
    clearTimers();
    const [tournaments, products, announcements, leaderboard] = await Promise.all([
      BR.data.getTournaments(), BR.data.getProducts(), BR.data.getAnnouncements(), BR.data.getLeaderboard(),
    ]);

    const live = tournaments.filter(t => t.status === 'LIVE');
    const totalPlayers = tournaments.reduce((s, t) => s + (t.current_players || 0), 0) + 3247;
    const prizePool = tournaments.reduce((s, t) => s + (parseInt(t.prize_label) || 0), 0);

    const statPlayers = $('#statPlayers'); if (statPlayers) animateStat(statPlayers, totalPlayers);
    const statLive = $('#statLive'); if (statLive) animateStat(statLive, live.length || 12);
    const statPrize = $('#statPrize'); if (statPrize) animateStat(statPrize, prizePool || 52000);

    renderTicker(announcements.length ? announcements : ['Welcome to BLOOD REIGN']);
    renderFeatured(live[0]);
    renderTodaysTournaments(tournaments.filter(t => t.status !== 'COMPLETED'));
    renderHotBags(products.filter(p => p.tag === 'HOT').concat(products).slice(0, 6));
    renderTopPlayers(leaderboard);
  }

  function wireHero() {
    const joinBtn = $('#heroJoinBtn');
    const shopBtn = $('#heroShopBtn');
    if (joinBtn) joinBtn.addEventListener('click', () => BR.nav.goTo('tournaments'));
    if (shopBtn) shopBtn.addEventListener('click', () => BR.nav.goTo('shop'));
  }

  function init() {
    wireHero();
    render();
    document.addEventListener('br:data-refresh', render);
  }

  return { init, render };
})();
