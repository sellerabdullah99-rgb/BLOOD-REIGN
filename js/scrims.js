/* ==========================================================
   BLOOD REIGN — Scrims
   Sub-section of the Tournaments tab. Any team captain can
   schedule a practice match; everyone can see the board.
   ========================================================== */

window.BR = window.BR || {};

BR.scrims = (function () {
  const { $, $$, escapeHtml, toast } = BR.utils;
  let myTeam = null;
  let allScrims = [];
  let allTeams = [];
  let showingTeams = false;

  function fmtDateTime(iso) {
    return new Date(iso).toLocaleString('en-PK', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  function renderHeader() {
    const el = $('#scrimsHeader');
    if (!el) return;
    el.innerHTML = `
      <div class="flex items-center gap-2" style="margin-bottom:10px">
        ${myTeam ? `<button class="btn btn-primary" id="scheduleScrimBtn" style="flex:1"><i class="fa-solid fa-calendar-plus"></i> Schedule a Scrim</button>` : ''}
        <button class="btn btn-outline" id="toggleTeamsBtn" style="flex:1"><i class="fa-solid fa-people-group"></i> ${showingTeams ? 'Hide' : 'Browse'} All Teams (${allTeams.length})</button>
      </div>
      ${!myTeam ? `<p class="muted" style="font-size:var(--text-sm);margin-bottom:8px"><i class="fa-solid fa-circle-info"></i> Create a team in Profile → My Team to schedule scrims.</p>` : ''}
      <div id="allTeamsList" style="display:${showingTeams ? '' : 'none'};margin-bottom:16px"></div>
    `;
    const btn = $('#scheduleScrimBtn');
    if (btn) btn.addEventListener('click', openScheduleModal);
    $('#toggleTeamsBtn').addEventListener('click', () => { showingTeams = !showingTeams; renderHeader(); });
    if (showingTeams) renderAllTeams();
  }

  function renderAllTeams() {
    const el = $('#allTeamsList');
    if (!el) return;
    if (!allTeams.length) {
      el.innerHTML = `<div class="empty-state"><i class="fa-solid fa-people-group"></i><h3>No teams yet</h3><p>Be the first to create one in Profile → My Team.</p></div>`;
      return;
    }
    el.innerHTML = `<div class="grid-1">${allTeams.map(t => `
      <div class="card" style="margin-bottom:4px">
        <div class="flex items-center justify-between mb-2">
          <div><strong>${escapeHtml(t.name)}</strong> <span class="badge badge-steel">${escapeHtml(t.tag)}</span></div>
          <span class="muted" style="font-size:var(--text-xs)"><i class="fa-solid fa-location-dot"></i> ${escapeHtml(t.region || 'Pakistan')}</span>
        </div>
        <div class="roster-mini-list" style="margin-bottom:${myTeam && myTeam.tag !== t.tag ? '10px' : '0'}">
          ${t.members.map(m => `<div class="roster-mini-row"><span>${escapeHtml(m.ign)}</span><span class="muted">${escapeHtml(m.role)}</span></div>`).join('')}
        </div>
        ${myTeam && myTeam.tag !== t.tag ? `<button class="btn btn-sm btn-outline btn-block" data-challenge-team="${escapeHtml(t.name)}"><i class="fa-solid fa-crosshairs"></i> Challenge to Scrim</button>` : ''}
      </div>`).join('')}</div>`;
    $$('[data-challenge-team]', el).forEach(btn => btn.addEventListener('click', () => openScheduleModal(btn.dataset.challengeTeam)));
  }

  function cardHTML(s) {
    const isMine = myTeam && s.host_team_id === myTeam.id;
    const statusBadge = s.status === 'SCHEDULED' ? '<span class="badge badge-outline-red">SCHEDULED</span>'
      : s.status === 'COMPLETED' ? '<span class="badge badge-green">COMPLETED</span>'
      : '<span class="badge badge-steel">CANCELLED</span>';
    return `
    <div class="card admin-row" data-scrim-id="${s.id}">
      <div>
        <div class="flex items-center gap-2 mb-2">${statusBadge}${s.mode ? `<span class="pill-mode pill-${s.mode.toLowerCase()}">${s.mode}</span>` : ''}</div>
        <strong>${escapeHtml(s.host_team_name || 'Team')} vs ${escapeHtml(s.opponent_name || 'TBD')}</strong>
        <div class="muted" style="font-size:var(--text-sm)">${fmtDateTime(s.scheduled_time)}${s.map ? ` • ${escapeHtml(s.map)}` : ''}</div>
        ${s.result ? `<div class="muted" style="font-size:var(--text-xs)">Result: ${escapeHtml(s.result)}</div>` : ''}
      </div>
      ${isMine && s.status === 'SCHEDULED' ? `
        <div class="admin-row-actions">
          <button class="btn btn-sm btn-outline" data-complete-scrim="${s.id}">Mark Done</button>
          <button class="btn btn-sm btn-ghost" data-cancel-scrim="${s.id}"><i class="fa-solid fa-xmark"></i></button>
        </div>` : ''}
    </div>`;
  }

  function wireCardActions(container) {
    $$('[data-complete-scrim]', container).forEach(btn => btn.addEventListener('click', async () => {
      const result = prompt('Result (optional, e.g. "Won 2-1"):') || null;
      await BR.data.updateScrimStatus(btn.dataset.completeScrim, 'COMPLETED', result);
      toast('Scrim updated', 'success');
      render();
    }));
    $$('[data-cancel-scrim]', container).forEach(btn => btn.addEventListener('click', async () => {
      if (!confirm('Cancel this scrim?')) return;
      await BR.data.updateScrimStatus(btn.dataset.cancelScrim, 'CANCELLED');
      render();
    }));
  }

  function renderList() {
    const el = $('#scrimsList');
    if (!el) return;
    if (!allScrims.length) {
      el.innerHTML = `<div class="empty-state"><i class="fa-solid fa-gun"></i><h3>No scrims scheduled</h3><p>Be the first team to line one up.</p></div>`;
      return;
    }
    el.innerHTML = `<div class="grid-1 stagger">${allScrims.map(cardHTML).join('')}</div>`;
    wireCardActions(el);
  }

  function openScheduleModal(prefillOpponent) {
    BR.ui.openModal('scheduleScrimModal', {
      title: 'Schedule a Scrim',
      bodyHTML: `
        <label class="field-label">Opponent Team Name</label>
        <input class="input" id="scrimOpponent" placeholder="e.g. Team Vortex" value="${escapeHtml(prefillOpponent || '')}" style="margin-bottom:12px">
        <label class="field-label">Mode</label>
        <select class="select" id="scrimMode" style="margin-bottom:12px"><option>SOLO</option><option>DUO</option><option selected>SQUAD</option></select>
        <label class="field-label">Map</label>
        <input class="input" id="scrimMap" placeholder="e.g. Bermuda" style="margin-bottom:12px">
        <label class="field-label">Date &amp; Time</label>
        <input class="input" id="scrimTime" type="datetime-local" style="margin-bottom:12px">
        <label class="field-label">Notes (optional)</label>
        <textarea class="textarea" id="scrimNotes" rows="2" style="margin-bottom:20px"></textarea>
        <button class="btn btn-primary btn-block" id="confirmScheduleScrimBtn">Schedule</button>
      `,
    });
    $('#confirmScheduleScrimBtn').addEventListener('click', async () => {
      const opponentName = $('#scrimOpponent').value.trim();
      const mode = $('#scrimMode').value;
      const map = $('#scrimMap').value.trim();
      const time = $('#scrimTime').value;
      const notes = $('#scrimNotes').value.trim();
      if (!opponentName || !time) { toast('Add an opponent and a time', 'default', 'fa-triangle-exclamation'); return; }
      const res = await BR.data.scheduleScrim(myTeam.id, { opponentName, mode, map, scheduledTime: new Date(time).toISOString(), notes });
      if (!res.ok) { toast('Could not schedule scrim', 'default', 'fa-triangle-exclamation'); return; }
      BR.ui.closeModal('scheduleScrimModal');
      toast('Scrim scheduled', 'success');
      render();
    });
  }

  async function render() {
    myTeam = await BR.data.getMyTeam();
    allScrims = await BR.data.getUpcomingScrims();
    allTeams = await BR.data.getAllTeams();
    renderHeader();
    renderList();
  }

  function init() {
    document.addEventListener('br:tourney-section-changed', (e) => { if (e.detail === 'scrims') render(); });
    document.addEventListener('br:profile-changed', () => { if (BR.nav.current === 'tournaments') render(); });
  }

  return { init, render };
})();
