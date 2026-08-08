/* ==========================================================
   BLOOD REIGN — Tournaments Tab
   ========================================================== */

window.BR = window.BR || {};

BR.tournaments = (function () {
  const { $, $$, escapeHtml, countdownString, sendDiscordWebhook, toast } = BR.utils;
  let activeFilter = 'ALL';
  let allTournaments = [];
  let countdownInterval = null;

  function cardHTML(t, opts = {}) {
    const statusBadge = t.status === 'LIVE'
      ? `<span class="badge badge-live"><i class="fa-solid fa-circle" style="font-size:6px"></i> LIVE</span>`
      : t.status === 'UPCOMING'
        ? `<span class="badge badge-outline-red">UPCOMING</span>`
        : `<span class="badge badge-steel">COMPLETED</span>`;

    const pct = Math.min(100, Math.round(((t.current_players || 0) / t.max_players) * 100));

    return `
    <div class="card card-hover tournament-card ${opts.compact ? 'compact' : ''}" data-tournament-id="${t.id}">
      ${t.is_grand_final ? '<div class="grand-final-tag">GRAND FINAL</div>' : ''}
      <div class="tc-top">${statusBadge}<span class="pill-mode pill-${t.mode.toLowerCase()}">${t.mode}</span></div>
      <h3 class="tc-name">${escapeHtml(t.name)}</h3>
      <div class="tc-map"><i class="fa-solid fa-map-location-dot"></i> ${escapeHtml(t.map)}</div>
      <div class="tc-prize">💎 ${escapeHtml(t.prize_label)}</div>
      ${t.sponsor ? `<div class="tc-sponsor"><i class="fa-solid fa-trophy"></i> Sponsored by ${escapeHtml(t.sponsor)}</div>` : ''}
      ${t.status === 'COMPLETED'
        ? `<div class="tc-winner"><i class="fa-solid fa-crown"></i> Winner: ${escapeHtml(t.winner_username || 'TBA')}</div>`
        : `
          <div class="tc-players">
            <div class="progress"><div class="progress-fill" style="width:${pct}%"></div></div>
            <span class="muted">${t.current_players || 0}/${t.max_players} joined</span>
          </div>
          <div class="tc-bottom">
            <span class="badge badge-green">✅ FREE ENTRY</span>
            <span class="tc-countdown" data-countdown="${t.start_time}">${countdownString(t.start_time)}</span>
          </div>
          <button class="btn btn-primary btn-block" data-join-tournament="${t.id}">
            <i class="fa-brands fa-discord"></i> JOIN NOW
          </button>
          <button class="btn btn-outline btn-sm btn-block" style="margin-top:8px" data-view-registered="${t.id}">
            <i class="fa-solid fa-list-ul"></i> ${t.mode === 'SOLO' ? 'View Registered Players' : 'View Registered Teams'}
          </button>`
      }
    </div>`;
  }

  function wireCardButtons(container) {
    $$('[data-join-tournament]', container).forEach(btn => {
      btn.addEventListener('click', () => {
        const t = allTournaments.find(t => t.id === btn.dataset.joinTournament);
        if (t) openJoinModal(t);
      });
    });
    $$('[data-view-registered]', container).forEach(btn => {
      btn.addEventListener('click', () => {
        const t = allTournaments.find(t => t.id === btn.dataset.viewRegistered);
        if (t) openRegisteredModal(t);
      });
    });
  }

  async function openRegisteredModal(tournament) {
    BR.ui.openModal('registeredModal', {
      title: tournament.mode === 'SOLO' ? 'Registered Players' : 'Registered Teams',
      bodyHTML: `<div id="registeredListWrap" class="text-center muted" style="padding:24px 0"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</div>`,
    });
    const { mode, players, teams } = await BR.data.getTournamentParticipants(tournament);
    const wrap = $('#registeredListWrap');
    if (!wrap) return;

    if (mode === 'SOLO') {
      wrap.innerHTML = !players.length
        ? `<div class="empty-state"><i class="fa-solid fa-user-group"></i><h3>No one yet</h3><p>Be the first to join this tournament.</p></div>`
        : `<div class="grid-1">${players.map((p, i) => `
            <div class="card admin-row">
              <div class="flex items-center gap-3">
                <div class="avatar" style="width:34px;height:34px;font-size:12px">${i + 1}</div>
                <div><strong>${escapeHtml(p.username)}</strong>${p.ff_uid ? `<div class="muted" style="font-size:var(--text-xs)">UID: ${escapeHtml(p.ff_uid)}</div>` : ''}</div>
              </div>
            </div>`).join('')}</div>`;
      return;
    }

    wrap.innerHTML = !teams.length
      ? `<div class="empty-state"><i class="fa-solid fa-people-group"></i><h3>No teams yet</h3><p>Be the first squad to register.</p></div>`
      : `<div class="grid-1">${teams.map(t => `
          <div class="card" style="margin-bottom:4px">
            <div class="flex items-center justify-between mb-2">
              <strong>${escapeHtml(t.name)}</strong> <span class="badge badge-steel">${escapeHtml(t.tag)}</span>
            </div>
            <div class="roster-mini-list">
              ${(t.roster || []).map(m => `<div class="roster-mini-row"><span>${escapeHtml(m.ign)}</span><span class="muted">${escapeHtml(m.role)}</span></div>`).join('')}
            </div>
          </div>`).join('')}</div>`;
  }

  function tickCountdowns() {
    clearInterval(countdownInterval);
    countdownInterval = setInterval(() => {
      $$('[data-countdown]').forEach(el => { el.textContent = countdownString(el.dataset.countdown); });
    }, 1000);
  }

  function renderFilterTabs() {
    const el = $('#tournamentFilterTabs');
    if (!el) return;
    const filters = ['ALL', 'LIVE', 'UPCOMING', 'COMPLETED'];
    el.innerHTML = filters.map(f => `<button class="pill-filter ${f === activeFilter ? 'active' : ''}" data-filter="${f}">${f}</button>`).join('');
    $$('[data-filter]', el).forEach(btn => btn.addEventListener('click', () => { activeFilter = btn.dataset.filter; render(); }));
  }

  function renderList() {
    const el = $('#tournamentList');
    if (!el) return;
    const filtered = activeFilter === 'ALL' ? allTournaments : allTournaments.filter(t => t.status === activeFilter);
    if (!filtered.length) {
      el.innerHTML = `<div class="empty-state"><i class="fa-solid fa-trophy"></i><h3>Nothing here yet</h3><p>Try a different filter.</p></div>`;
      return;
    }
    el.innerHTML = `<div class="grid-1 stagger">${filtered.map(t => cardHTML(t)).join('')}</div>`;
    wireCardButtons(el);
    tickCountdowns();
  }

  function renderRules() {
    const el = $('#tournamentRules');
    if (!el || el.dataset.rendered) return;
    const rules = [
      'No hacking or third-party tools',
      'Screenshot/video proof required for prize claim',
      'Admin decision is final in all disputes',
      'Join our Discord server after registration',
      'One account per player only',
    ];
    el.innerHTML = `
      <div class="accordion-item">
        <button class="accordion-trigger"><span>Tournament Rules</span><i class="fa-solid fa-chevron-down"></i></button>
        <div class="accordion-content"><ul class="rules-list">${rules.map(r => `<li><i class="fa-solid fa-check"></i> ${r}</li>`).join('')}</ul></div>
      </div>`;
    el.dataset.rendered = '1';
    el.querySelector('.accordion-trigger').addEventListener('click', () => {
      el.querySelector('.accordion-item').classList.toggle('open');
    });
  }

  function openJoinModal(tournament) {
    if (tournament.mode === 'SOLO') return openIndividualJoinModal(tournament);
    return openTeamJoinModal(tournament);
  }

  function openIndividualJoinModal(tournament) {
    const profile = BR.auth.getProfile();
    BR.ui.openModal('joinTournamentModal', {
      title: `Join ${tournament.name}`,
      bodyHTML: `
        <p class="muted" style="margin-bottom:16px">Entry is 100% free — sponsor funded. Fill your details and we'll post your slot confirmation to our Discord.</p>
        <label class="field-label">Free Fire UID</label>
        <input class="input" id="joinFfUid" placeholder="e.g. 123456789" value="${escapeHtml(profile?.ff_uid || '')}" inputmode="numeric" style="margin-bottom:12px">
        <label class="field-label">In-game Username</label>
        <input class="input" id="joinUsername" placeholder="e.g. FireStorm_PK" value="${escapeHtml(profile?.username && profile.username !== 'Guest Warrior' ? profile.username : '')}" style="margin-bottom:20px">
        <button class="btn btn-primary btn-block" id="confirmJoinBtn"><i class="fa-brands fa-discord"></i> JOIN NOW</button>
      `,
    });
    $('#confirmJoinBtn').addEventListener('click', async () => {
      const ffUid = $('#joinFfUid').value.trim();
      const username = $('#joinUsername').value.trim();
      if (!ffUid || !username) { toast('Enter your FF UID and username', 'default', 'fa-triangle-exclamation'); return; }

      const res = await BR.data.registerForTournament(tournament.id, ffUid, username);
      if (!res.ok) { toast(res.error === 'tournament_full' ? 'This tournament is full' : 'Could not register — try again', 'default', 'fa-triangle-exclamation'); return; }

      await BR.auth.updateProfileFields({ ff_uid: ffUid, username });
      const text = `🎮 **BLOOD REIGN TOURNAMENT JOIN**\nTournament: ${tournament.name}\nMode: ${tournament.mode}\nFF UID: ${ffUid}\nUsername: ${username}\nEntry: FREE ✅`;
      const sent = await sendDiscordWebhook(text);
      BR.ui.closeModal('joinTournamentModal');
      toast(sent.ok ? "Registered! We'll confirm on Discord" : 'Registered! (Discord notify failed — we still got your slot)', sent.ok ? 'success' : 'default');
      render();
    });
  }

  async function openTeamJoinModal(tournament) {
    const team = await BR.data.getMyTeam();
    const minNeeded = tournament.mode === 'DUO' ? 2 : 4;

    if (!team) {
      BR.ui.openModal('teamJoinModal', {
        title: `Register Team — ${tournament.name}`,
        bodyHTML: `
          <div class="empty-state">
            <i class="fa-solid fa-people-group"></i>
            <h3>You need a team first</h3>
            <p>${tournament.mode} tournaments register as a squad. Build your roster in Profile → My Team, then come back here.</p>
          </div>
          <button class="btn btn-primary btn-block" id="goToMyTeamBtn" style="margin-top:12px">Go to My Team</button>`,
      });
      $('#goToMyTeamBtn').addEventListener('click', () => { BR.ui.closeModal('teamJoinModal'); BR.nav.goTo('profile'); });
      return;
    }

    const rosterOk = team.members.length >= minNeeded;
    BR.ui.openModal('teamJoinModal', {
      title: `Register Team — ${tournament.name}`,
      bodyHTML: `
        <div class="card" style="margin-bottom:16px">
          <div class="flex items-center justify-between mb-2">
            <strong>${escapeHtml(team.name)} [${escapeHtml(team.tag)}]</strong>
            <span class="badge ${rosterOk ? 'badge-green' : 'badge-steel'}">${team.members.length}/${minNeeded} needed</span>
          </div>
          <div class="roster-mini-list">
            ${team.members.map(m => `<div class="roster-mini-row"><span>${escapeHtml(m.ign)}</span><span class="muted">${m.role}</span></div>`).join('')}
          </div>
        </div>
        ${rosterOk
          ? `<button class="btn btn-primary btn-block" id="confirmTeamJoinBtn"><i class="fa-brands fa-discord"></i> REGISTER TEAM</button>`
          : `<p style="color:var(--danger);font-size:var(--text-sm);margin-bottom:14px"><i class="fa-solid fa-triangle-exclamation"></i> Need at least ${minNeeded} players for ${tournament.mode}. Add more in My Team.</p>
             <button class="btn btn-outline btn-block" id="goToMyTeamBtn">Go to My Team</button>`}
      `,
    });

    const goBtn = $('#goToMyTeamBtn');
    if (goBtn) goBtn.addEventListener('click', () => { BR.ui.closeModal('teamJoinModal'); BR.nav.goTo('profile'); });

    const confirmBtn = $('#confirmTeamJoinBtn');
    if (confirmBtn) confirmBtn.addEventListener('click', async () => {
      const res = await BR.data.registerTeamForTournament(tournament, team.id);
      if (!res.ok) {
        const msg = res.error === 'tournament_full' ? 'This tournament is full'
          : res.error === 'roster_too_small' ? `Need at least ${res.need || minNeeded} players`
          : 'Could not register — try again';
        toast(msg, 'default', 'fa-triangle-exclamation');
        return;
      }
      const rosterText = team.members.map(m => `${m.role}: ${m.ign} (${m.full_name})`).join('\n');
      const text = `🎮 **BLOOD REIGN SQUAD REGISTRATION**\nTournament: ${tournament.name}\nMode: ${tournament.mode}\nTeam: ${team.name} [${team.tag}]\nRoster:\n${rosterText}\nEntry: FREE ✅`;
      const sent = await sendDiscordWebhook(text);
      BR.ui.closeModal('teamJoinModal');
      toast(sent.ok ? "Team registered! We'll confirm on Discord" : 'Team registered! (Discord notify failed — we still got your slot)', sent.ok ? 'success' : 'default');
      render();
    });
  }

  // ---------------------------------------------------------
  // Section switcher: Tournaments / Scrims / Tryouts
  // ---------------------------------------------------------
  let activeSection = 'tournaments';

  function renderSectionTabs() {
    const el = $('#tourneySectionTabs');
    if (!el) return;
    const sections = [
      { key: 'tournaments', label: 'Tournaments', icon: 'fa-trophy' },
      { key: 'scrims', label: 'Scrims', icon: 'fa-gun' },
      { key: 'tryouts', label: 'Tryouts', icon: 'fa-people-group' },
    ];
    el.innerHTML = sections.map(s => `<button class="pill-filter ${s.key === activeSection ? 'active' : ''}" data-section="${s.key}"><i class="fa-solid ${s.icon}"></i> ${s.label}</button>`).join('');
    $$('[data-section]', el).forEach(btn => btn.addEventListener('click', () => showSection(btn.dataset.section)));
  }

  function showSection(key) {
    activeSection = key;
    renderSectionTabs();
    ['tournaments', 'scrims', 'tryouts'].forEach(k => {
      const panel = $(`#tourneySection-${k}`);
      if (panel) panel.style.display = k === key ? '' : 'none';
    });
    document.dispatchEvent(new CustomEvent('br:tourney-section-changed', { detail: key }));
  }

  async function render() {
    allTournaments = await BR.data.getTournaments();
    renderSectionTabs();
    renderFilterTabs();
    renderList();
    renderRules();
  }

  function init() {
    render();
    document.addEventListener('br:data-refresh', render);
  }

  return { init, render, cardHTML, wireCardButtons, openJoinModal, showSection };
})();
