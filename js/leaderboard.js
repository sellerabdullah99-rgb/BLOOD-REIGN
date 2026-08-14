/* ==========================================================
   BLOOD REIGN — Leaderboard Tab
   ========================================================== */

window.BR = window.BR || {};

BR.leaderboard = (function () {
  const { $, $$, formatCompact, initials } = BR.utils;
  let scope = 'ALL'; // 'ALL' | 'WEEK' — see data.js note on weekly tracking

  function renderScopeToggle() {
    const el = $('#leaderboardScopeToggle');
    if (!el) return;
    el.innerHTML = ['WEEK', 'ALL'].map(s => `<button class="pill-filter ${s === scope ? 'active' : ''}" data-scope="${s}">${s === 'WEEK' ? 'This Week' : 'All Time'}</button>`).join('');
    $$('[data-scope]', el).forEach(btn => btn.addEventListener('click', () => { scope = btn.dataset.scope; render(); }));
  }

  function renderPodium(top3) {
    const el = $('#leaderboardPodium');
    if (!el) return;
    if (top3.length < 3) { el.innerHTML = ''; return; }
    const order = [top3[1], top3[0], top3[2]]; // 2nd, 1st, 3rd for visual podium
    const heights = ['110px', '140px', '90px'];
    const medals = ['🥈', '🥇', '🥉'];
    el.innerHTML = order.map((p, i) => `
      <div class="podium-col">
        <div class="avatar podium-avatar">${initials(p.username)}</div>
        <div class="podium-medal">${medals[i]}</div>
        <div class="podium-name">${p.username}</div>
        <div class="podium-kills muted">${formatCompact(p.total_kills)} kills</div>
        <div class="podium-bar" style="height:${heights[i]}"></div>
      </div>`).join('');
  }

  function renderList(rest, startRank) {
    const el = $('#leaderboardList');
    if (!el) return;
    if (!rest.length) { el.innerHTML = ''; return; }
    el.innerHTML = rest.map((p, i) => `
      <div class="lb-row">
        <span class="lb-rank">#${startRank + i}</span>
        <span class="avatar" style="width:36px;height:36px;font-size:13px">${initials(p.username)}</span>
        <div class="lb-info"><strong>${p.username}</strong><span class="muted">${p.total_wins} wins</span></div>
        <span class="lb-kills">${formatCompact(p.total_kills)}<span class="muted"> kills</span></span>
      </div>`).join('');
  }

  function renderMyRank(list) {
    const profile = BR.auth.getProfile();
    const el = $('#myRankBanner');
    if (!el || !profile) return;
    const idx = list.findIndex(p => p.username === profile.username);
    if (idx === -1) {
      el.innerHTML = `<i class="fa-solid fa-arrow-trend-up"></i> Join a tournament to appear on the leaderboard!`;
    } else {
      el.innerHTML = `<i class="fa-solid fa-medal"></i> You're ranked <strong>#${idx + 1}</strong> with ${formatCompact(list[idx].total_kills)} kills`;
    }
  }

  async function render() {
    renderScopeToggle();
    const list = await BR.data.getLeaderboard();
    renderNoActivityBanner(list);
    renderPodium(list.slice(0, 3));
    renderList(list.slice(3), 4);
    renderMyRank(list);
  }

  function renderNoActivityBanner(list) {
    const el = $('#leaderboardNoActivity');
    if (!el) return;
    const allZero = list.length > 0 && list.every(p => !p.total_kills);
    el.innerHTML = allZero
      ? `<div class="empty-state" style="padding:16px"><i class="fa-solid fa-flag-checkered"></i> No kills recorded yet — stats fill in once tournaments are completed by admins.</div>`
      : '';
  }

  function init() {
    render();
    document.addEventListener('br:data-refresh', render);
    document.addEventListener('br:tab-changed', (e) => { if (e.detail === 'leaderboard') render(); });
  }

  return { init, render };
})();
