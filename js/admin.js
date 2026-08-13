/* ==========================================================
   BLOOD REIGN — Admin Panel
   UI access is gated by 5 taps on the footer mark + a local
   passcode (js/config.js). That only reveals the tab — real
   protection is the is_admin flag + RLS policies in Supabase,
   which must be set manually in the dashboard for security.
   ========================================================== */

window.BR = window.BR || {};

BR.admin = (function () {
  const { $, $$, escapeHtml, formatPKR, toast } = BR.utils;

  function promptGatePassword() {
    BR.ui.openModal('adminGateModal', {
      title: 'Admin Access',
      bodyHTML: `
        <label class="field-label">Passcode</label>
        <input class="input" id="adminGatePw" type="password" placeholder="••••••••" style="margin-bottom:16px">
        <button class="btn btn-primary btn-block" id="adminGateSubmit">Unlock</button>
      `,
    });
    const submit = () => {
      const val = $('#adminGatePw').value;
      if (val === BR.config.ADMIN_TAP_GATE_PASSWORD) {
        BR.nav.unlockAdminTab();
        BR.ui.closeModal('adminGateModal');
        BR.nav.goTo('admin');
        render();
        toast('Admin panel unlocked', 'success');
      } else {
        toast('Incorrect passcode', 'default', 'fa-triangle-exclamation');
      }
    };
    $('#adminGateSubmit').addEventListener('click', submit);
    $('#adminGatePw').addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  }

  function renderSecurityNotice() {
    const el = $('#adminSecurityNotice');
    if (!el || el.dataset.rendered) return;
    el.dataset.rendered = '1';
    if (!BR.isConfigured) {
      el.innerHTML = `<div class="card" style="border-color:var(--gold)"><i class="fa-solid fa-triangle-exclamation" style="color:var(--gold)"></i> Local demo mode — changes here only affect this browser. Connect Supabase for real, multi-device admin control.</div>`;
    } else if (!BR.auth.getProfile()?.is_admin) {
      el.innerHTML = `<div class="card" style="border-color:var(--danger)"><i class="fa-solid fa-shield-halved" style="color:var(--danger)"></i> This account isn't flagged as admin in Supabase yet. Writes will be rejected by RLS until you set <code>is_admin = true</code> on your profile row from the Supabase dashboard.</div>`;
    }
  }

  async function renderDashboard() {
    const stats = await BR.data.getAnalytics();
    const el = $('#adminDashboardGrid');
    if (!el) return;
    const cards = [
      { icon: 'fa-users', label: 'Players', value: stats.totalPlayers },
      { icon: 'fa-trophy', label: 'Tournaments', value: stats.totalTournaments },
      { icon: 'fa-circle', label: 'Live Now', value: stats.liveTournaments },
      { icon: 'fa-bag-shopping', label: 'Total Orders', value: stats.totalOrders },
      { icon: 'fa-sack-dollar', label: 'Revenue (7d)', value: formatPKR(Math.round(stats.revenueThisWeek)) },
      { icon: 'fa-star', label: 'Top Product', value: stats.topProduct ? stats.topProduct.name : '—' },
    ];
    el.innerHTML = cards.map(c => `<div class="card stat-card"><i class="fa-solid ${c.icon}"></i><div class="stat-value" style="font-size:var(--text-lg)">${c.value}</div><div class="muted stat-label">${c.label}</div></div>`).join('');
  }

  async function renderTournamentManager() {
    const el = $('#adminTournamentList');
    if (!el) return;
    const tournaments = await BR.data.getTournaments();
    el.innerHTML = tournaments.map(t => `
      <div class="card admin-row">
        <div><strong>${escapeHtml(t.name)}</strong><span class="muted"> — ${t.mode} · ${t.status}</span></div>
        <div class="admin-row-actions">
          ${t.status === 'UPCOMING' ? `<button class="btn btn-sm btn-outline" data-go-live="${t.id}"><i class="fa-solid fa-tower-broadcast"></i> Go Live</button>` : ''}
          ${t.status === 'LIVE' ? `<button class="btn btn-sm btn-outline" data-complete-tournament="${t.id}">Complete Tournament</button>` : ''}
          ${t.status !== 'COMPLETED' ? `<button class="btn btn-sm btn-outline" data-set-room="${t.id}"><i class="fa-solid fa-key"></i> Set Room</button>` : ''}
          <button class="btn btn-sm btn-ghost" data-delete-tournament="${t.id}"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>`).join('');

    $$('[data-set-room]', el).forEach(btn => btn.addEventListener('click', () => {
      const t = tournaments.find(x => x.id === btn.dataset.setRoom);
      if (t) openSetRoomModal(t);
    }));

    $$('[data-go-live]', el).forEach(btn => btn.addEventListener('click', async () => {
      const res = await BR.data.adminSetTournamentStatus(btn.dataset.goLive, 'LIVE');
      if (res.ok) { toast('Tournament is now LIVE', 'success'); renderTournamentManager(); renderDashboard(); }
      else toast(res.error || 'Failed', 'default', 'fa-triangle-exclamation');
    }));

    $$('[data-complete-tournament]', el).forEach(btn => btn.addEventListener('click', () => {
      const t = tournaments.find(x => x.id === btn.dataset.completeTournament);
      if (t) openCompleteTournamentModal(t);
    }));
    $$('[data-delete-tournament]', el).forEach(btn => btn.addEventListener('click', async () => {
      if (!confirm('Delete this tournament?')) return;
      const res = await BR.data.adminDeleteTournament(btn.dataset.deleteTournament);
      if (res && res.ok === false) {
        toast(res.error || 'Delete failed — check you have is_admin set in Supabase', 'default', 'fa-triangle-exclamation');
        return;
      }
      renderTournamentManager();
    }));
  }

  function openSetRoomModal(t) {
    BR.ui.openModal('setRoomModal', {
      title: `Room Details — ${escapeHtml(t.name)}`,
      bodyHTML: `
        <p class="muted" style="margin-bottom:14px;font-size:var(--text-sm)">Room ID/Password stay hidden from players (enforced server-side) until the reveal time you set below.</p>
        <label class="field-label">Room ID</label>
        <input class="input" id="roomIdInput" placeholder="e.g. 123456789" style="margin-bottom:12px">
        <label class="field-label">Room Password</label>
        <input class="input" id="roomPasswordInput" placeholder="e.g. br2026" style="margin-bottom:12px">
        <label class="field-label">Reveal At</label>
        <input class="input" id="roomRevealInput" type="datetime-local" style="margin-bottom:20px">
        <button class="btn btn-primary btn-block" id="saveRoomBtn"><i class="fa-solid fa-key"></i> Save Room Details</button>
      `,
    });
    $('#saveRoomBtn').addEventListener('click', async () => {
      const roomId = $('#roomIdInput').value.trim();
      const password = $('#roomPasswordInput').value.trim();
      const reveal = $('#roomRevealInput').value;
      if (!roomId || !password) { toast('Enter Room ID and Password', 'default', 'fa-triangle-exclamation'); return; }
      if (!reveal) { toast('Pick a reveal time', 'default', 'fa-triangle-exclamation'); return; }
      const res = await BR.data.adminSetTournamentRoom(t.id, roomId, password, new Date(reveal).toISOString());
      if (res.ok) {
        toast('Room details saved — will reveal at the set time', 'success');
        BR.ui.closeModal('setRoomModal');
      } else toast(res.error || 'Failed', 'default', 'fa-triangle-exclamation');
    });
  }

  async function openCompleteTournamentModal(t) {
    const res = await BR.data.adminGetTournamentParticipants(t.id);
    const participants = res.participants || [];

    const rowsHTML = participants.length
      ? participants.map((p, i) => `
          <div class="admin-row" style="align-items:center;gap:10px" data-kill-row data-idx="${i}">
            <label style="display:flex;align-items:center;gap:8px;flex:1;cursor:pointer">
              <input type="radio" name="winnerPick" value="p-${i}">
              <span>${escapeHtml(p.username || p.ign)}${p.team_name ? ` <span class="muted">(${escapeHtml(p.team_name)})</span>` : ''}</span>
            </label>
            <input class="input" type="number" min="0" placeholder="Kills" data-kills-input value="0" style="width:90px">
          </div>`).join('')
      : `<p class="muted" style="margin-bottom:10px;font-size:var(--text-sm)">No registrations found here (demo mode has no shared data across users) — add players manually below.</p>`;

    BR.ui.openModal('completeTournamentModal', {
      title: `Complete — ${escapeHtml(t.name)}`,
      bodyHTML: `
        <p class="muted" style="margin-bottom:14px;font-size:var(--text-sm)">Enter each player's kills, then select the winner. Kills add to their profile total; the winner gets +1 win and +100 coins.</p>
        <div id="killRowsContainer" style="margin-bottom:14px">${rowsHTML}</div>
        ${!participants.length ? `
          <div class="admin-form-grid" style="margin-bottom:10px">
            <input class="input" id="manualUsername" placeholder="Username">
            <input class="input" id="manualKills" type="number" min="0" placeholder="Kills" value="0">
          </div>
          <button class="btn btn-sm btn-outline btn-block" id="addManualRowBtn" style="margin-bottom:16px">+ Add Player</button>
          <label class="field-label">Winner Username</label>
          <input class="input" id="manualWinner" placeholder="Type winner's username" style="margin-bottom:16px">
        ` : ''}
        <button class="btn btn-primary btn-block" id="saveCompleteBtn"><i class="fa-solid fa-flag-checkered"></i> Save &amp; Complete</button>
      `,
    });

    const manualRows = [];
    const addBtn = $('#addManualRowBtn');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        const uname = $('#manualUsername').value.trim();
        const kills = parseInt($('#manualKills').value) || 0;
        if (!uname) { toast('Enter a username', 'default', 'fa-triangle-exclamation'); return; }
        manualRows.push({ username: uname, kills });
        const container = $('#killRowsContainer');
        const row = document.createElement('div');
        row.className = 'admin-row';
        row.style.cssText = 'align-items:center;gap:10px';
        row.innerHTML = `<label style="display:flex;align-items:center;gap:8px;flex:1;cursor:pointer"><input type="radio" name="winnerPick" value="m-${manualRows.length - 1}"><span>${escapeHtml(uname)}</span></label><span class="muted">${kills} kills</span>`;
        container.appendChild(row);
        $('#manualUsername').value = '';
        $('#manualKills').value = '0';
      });
    }

    $('#saveCompleteBtn').addEventListener('click', async () => {
      let results = [];
      let winner = null;
      const winnerRadio = document.querySelector('input[name=winnerPick]:checked');

      if (participants.length) {
        $$('[data-kill-row]').forEach((row) => {
          const idx = parseInt(row.dataset.idx);
          const kills = parseInt(row.querySelector('[data-kills-input]').value) || 0;
          const p = participants[idx];
          results.push({ profile_id: p.profile_id, username: p.username, kills });
        });
        if (winnerRadio && winnerRadio.value.startsWith('p-')) {
          const p = participants[parseInt(winnerRadio.value.split('-')[1])];
          winner = { profile_id: p.profile_id, username: p.username };
        }
      } else {
        results = manualRows;
        if (winnerRadio && winnerRadio.value.startsWith('m-')) {
          winner = { username: manualRows[parseInt(winnerRadio.value.split('-')[1])]?.username };
        }
      }
      const manualWinnerInput = $('#manualWinner');
      if (!winner && manualWinnerInput && manualWinnerInput.value.trim()) {
        winner = { username: manualWinnerInput.value.trim() };
      }

      if (!winner || !winner.username) { toast('Pick a winner (or type one manually)', 'default', 'fa-triangle-exclamation'); return; }

      const saveRes = await BR.data.adminCompleteTournament(t.id, results, winner);
      if (saveRes.ok) {
        BR.ui.closeModal('completeTournamentModal');
        toast('Tournament completed — kills & winner saved', 'success');
        renderTournamentManager(); renderDashboard();
      } else {
        toast(saveRes.error || 'Failed', 'default', 'fa-triangle-exclamation');
      }
    });
  }

  async function renderScrimManager() {
    const el = $('#adminScrimList');
    if (!el) return;
    const scrims = await BR.data.getUpcomingScrims();
    if (!scrims.length) { el.innerHTML = `<div class="empty-state"><p>No scrims scheduled yet.</p></div>`; return; }
    el.innerHTML = scrims.map(s => `
      <div class="card admin-row">
        <div><strong>${escapeHtml(s.host_team_name || 'Unknown team')}</strong> vs <span>${escapeHtml(s.opponent_name)}</span>
          <div class="muted" style="font-size:var(--text-xs)">${escapeHtml(s.map)} · ${escapeHtml(s.mode)} · ${new Date(s.scheduled_time).toLocaleString()} · ${s.status}</div>
        </div>
        <button class="btn btn-sm btn-ghost" data-delete-scrim="${s.id}"><i class="fa-solid fa-trash"></i></button>
      </div>`).join('');
    $$('[data-delete-scrim]', el).forEach(btn => btn.addEventListener('click', async () => {
      if (!confirm('Delete this scrim?')) return;
      const res = await BR.data.deleteScrim(btn.dataset.deleteScrim);
      if (res.ok) renderScrimManager(); else toast(res.error || 'Failed', 'default', 'fa-triangle-exclamation');
    }));
  }

  async function renderTryoutManager() {
    const el = $('#adminTryoutList');
    if (!el) return;
    const tryouts = await BR.data.adminGetAllTryouts();
    if (!tryouts.length) { el.innerHTML = `<div class="empty-state"><p>No tryouts posted yet.</p></div>`; return; }

    el.innerHTML = tryouts.map(t => `
      <div class="card" style="margin-bottom:10px">
        <div class="admin-row">
          <div>
            <strong>${escapeHtml(t.team_name || 'Unknown team')}</strong>
            ${t.target_profile_id
              ? ` — planned trial with <span class="badge badge-gold">${escapeHtml(t.target_username || 'a player')}</span>`
              : ` needs <span>${escapeHtml(t.role_needed)}</span>`}
            <div class="muted" style="font-size:var(--text-xs)">
              ${t.scheduled_time ? `📅 ${new Date(t.scheduled_time).toLocaleString()} · ` : ''}${escapeHtml(t.description || '')}
            </div>
          </div>
          <span class="badge ${t.status === 'OPEN' ? 'badge-green' : 'badge-steel'}">${t.status}</span>
        </div>
        <div data-tryout-apps="${t.id}" style="margin-top:8px"></div>
      </div>`).join('');

    for (const t of tryouts) {
      if (t.status !== 'OPEN') continue;
      const holder = $(`[data-tryout-apps="${t.id}"]`, el);
      if (!holder) continue;

      if (t.target_profile_id) {
        // Planned 1-on-1 trial — no applications, just mark the outcome.
        holder.innerHTML = `
          <div class="admin-row" style="padding:8px 0;border-top:1px solid var(--border)">
            <span class="muted" style="font-size:var(--text-xs)">After the trial:</span>
            <div class="admin-row-actions">
              <button class="btn btn-sm btn-primary" data-planned-pass="${t.id}|${t.team_id}|${t.target_profile_id}|${t.role_needed}">Passed — Add to Roster</button>
              <button class="btn btn-sm btn-outline" data-planned-fail="${t.id}">Didn't pass</button>
            </div>
          </div>`;
        continue;
      }

      const apps = await BR.data.adminGetTryoutApplications(t.id);
      const pending = apps.filter(a => a.status === 'PENDING');
      if (!pending.length) { holder.innerHTML = `<p class="muted" style="font-size:var(--text-xs)">No applications yet.</p>`; continue; }
      holder.innerHTML = pending.map(a => `
        <div class="admin-row" style="padding:8px 0;border-top:1px solid var(--border)">
          <span>${escapeHtml(a.ign)} <span class="muted">(${escapeHtml(a.full_name)})</span></span>
          <div class="admin-row-actions">
            <button class="btn btn-sm btn-primary" data-respond="${a.id}|ACCEPTED">Accept</button>
            <button class="btn btn-sm btn-outline" data-respond="${a.id}|REJECTED">Reject</button>
          </div>
        </div>`).join('');
    }
    $$('[data-respond]', el).forEach(btn => btn.addEventListener('click', async () => {
      const [appId, status] = btn.dataset.respond.split('|');
      const res = await BR.data.respondToTryout(appId, status);
      if (res.ok) { toast(status === 'ACCEPTED' ? 'Player added to roster' : 'Application rejected', 'success'); renderTryoutManager(); }
      else toast(res.error || 'Failed', 'default', 'fa-triangle-exclamation');
    }));
    $$('[data-planned-pass]', el).forEach(btn => btn.addEventListener('click', async () => {
      const [tryoutId, teamId, profileId, role] = btn.dataset.plannedPass.split('|');
      const res = await BR.data.adminAddRegisteredPlayerToTeam(teamId, profileId, role);
      if (res.ok) {
        await BR.data.updateTryoutStatus(tryoutId, 'CLOSED');
        toast('Player added to roster', 'success');
        renderTryoutManager();
      } else toast(res.error || 'Failed', 'default', 'fa-triangle-exclamation');
    }));
    $$('[data-planned-fail]', el).forEach(btn => btn.addEventListener('click', async () => {
      await BR.data.updateTryoutStatus(btn.dataset.plannedFail, 'CLOSED');
      toast('Marked as closed', 'default');
      renderTryoutManager();
    }));
  }

  // Shared "search registered players" widget used by both the direct-add
  // and schedule-tryout tools. Returns a getter for whatever's selected.
  function wirePlayerSearchWidget(searchId, resultsId, onSelect) {
    const searchInput = $('#' + searchId);
    const resultsEl = $('#' + resultsId);
    let selected = null;
    searchInput.addEventListener('input', async () => {
      const q = searchInput.value.trim();
      selected = null;
      if (q.length < 2) { resultsEl.innerHTML = ''; return; }
      const matches = await BR.data.adminSearchProfiles(q);
      resultsEl.innerHTML = matches.length
        ? matches.map(p => {
            const online = BR.auth.isOnline(p.last_active_at);
            return `<button class="btn btn-sm btn-outline" data-pick-profile="${p.id}" data-username="${escapeHtml(p.username)}" style="margin:4px 6px 0 0">
                      <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${online ? '#22c55e' : '#6b7280'};margin-right:6px"></span>${escapeHtml(p.username)}${online ? ' · online' : ''}
                    </button>`;
          }).join('')
        : `<p class="muted" style="font-size:var(--text-xs)">No matching registered players.</p>`;
      $$('[data-pick-profile]', resultsEl).forEach(b => b.addEventListener('click', async () => {
        selected = { id: b.dataset.pickProfile, username: b.dataset.username };
        resultsEl.innerHTML = `<span class="badge badge-green">Selected: ${escapeHtml(selected.username)}</span>`;
        if (onSelect) await onSelect(selected);
      }));
    });
    return {
      get: () => selected,
      reset: () => { searchInput.value = ''; resultsEl.innerHTML = ''; selected = null; },
    };
  }

  async function fillTeamSelect(selectId, excludeTeamIds = []) {
    const teams = await BR.data.adminGetAllTeams();
    const sel = $('#' + selectId);
    if (!sel) return;
    const filtered = teams.filter(t => !excludeTeamIds.includes(t.id));
    sel.innerHTML = filtered.length
      ? filtered.map(t => `<option value="${t.id}">${escapeHtml(t.name)} [${escapeHtml(t.tag)}]</option>`).join('')
      : `<option value="">${teams.length ? "Player is already in every team" : 'No teams yet — create one in the Teams tab first'}</option>`;
  }

  function wireAddPlayerToTeamForm() {
    const btn = $('#adminAddPlayerBtn');
    if (!btn || btn.dataset.wired) return;
    btn.dataset.wired = '1';

    const player = wirePlayerSearchWidget('addPlayerSearch', 'addPlayerResults', async (selected) => {
      const excludeIds = await BR.data.adminGetPlayerTeamIds(selected.id);
      fillTeamSelect('addPlayerTeam', excludeIds);
    });
    fillTeamSelect('addPlayerTeam');

    btn.addEventListener('click', async () => {
      const teamId = $('#addPlayerTeam').value;
      const role = $('#addPlayerRole').value;
      const selected = player.get();
      if (!selected) { toast('Search and pick a registered player first', 'default', 'fa-triangle-exclamation'); return; }
      if (!teamId) { toast('Pick a team', 'default', 'fa-triangle-exclamation'); return; }
      const res = await BR.data.adminAddRegisteredPlayerToTeam(teamId, selected.id, role);
      if (res.ok) { toast(`${selected.username} added to the team`, 'success'); player.reset(); }
      else toast(res.error || 'Failed', 'default', 'fa-triangle-exclamation');
    });
  }

  function wireScheduleTryoutForm() {
    const btn = $('#adminScheduleTryoutBtn');
    if (!btn || btn.dataset.wired) return;
    btn.dataset.wired = '1';

    const player = wirePlayerSearchWidget('scheduleTryoutSearch', 'scheduleTryoutResults');
    fillTeamSelect('scheduleTryoutTeam');

    btn.addEventListener('click', async () => {
      const teamId = $('#scheduleTryoutTeam').value;
      const role = $('#scheduleTryoutRole').value;
      const time = $('#scheduleTryoutTime').value;
      const notes = $('#scheduleTryoutNotes').value.trim();
      const selected = player.get();
      if (!selected) { toast('Search and pick a registered player first', 'default', 'fa-triangle-exclamation'); return; }
      if (!teamId) { toast('Pick a team', 'default', 'fa-triangle-exclamation'); return; }
      if (!time) { toast('Pick a date & time', 'default', 'fa-triangle-exclamation'); return; }
      const res = await BR.data.adminScheduleTryout(teamId, selected.id, role, new Date(time).toISOString(), notes);
      if (res.ok) {
        toast(`Trial scheduled with ${selected.username}`, 'success');
        player.reset(); $('#scheduleTryoutTime').value = ''; $('#scheduleTryoutNotes').value = '';
        renderTryoutManager();
      } else toast(res.error || 'Failed', 'default', 'fa-triangle-exclamation');
    });
  }

  function wireCreateTournamentForm() {
    const btn = $('#adminCreateTournamentBtn');
    if (!btn || btn.dataset.wired) return;
    btn.dataset.wired = '1';
    btn.addEventListener('click', async () => {
      const name = $('#newTName').value.trim();
      const mode = $('#newTMode').value;
      const map = $('#newTMap').value.trim();
      const prize = $('#newTPrize').value.trim();
      const maxPlayers = parseInt($('#newTMax').value) || 50;
      if (!name || !map || !prize) { toast('Fill in all fields', 'default', 'fa-triangle-exclamation'); return; }
      const res = await BR.data.adminCreateTournament({
        name, mode, map, prize_label: prize, max_players: maxPlayers,
        status: 'UPCOMING', start_time: new Date(Date.now() + 86400000).toISOString(), is_grand_final: false,
      });
      if (res.ok) {
        toast('Tournament created', 'success');
        ['newTName', 'newTMap', 'newTPrize'].forEach(id => $('#' + id).value = '');
        renderTournamentManager(); renderDashboard();
      } else toast(res.error || 'Failed', 'default', 'fa-triangle-exclamation');
    });
  }

  async function renderOrderManager() {
    const el = $('#adminOrderList');
    if (!el) return;
    const orders = await BR.data.getOrders();
    if (!orders.length) { el.innerHTML = `<div class="empty-state"><p>No orders yet.</p></div>`; return; }
    el.innerHTML = orders.map(o => `
      <div class="card admin-row">
        <div><strong>${escapeHtml(o.product_name)}</strong><span class="muted"> — ${formatPKR(o.price)}${o.discount_pct ? ` (${o.discount_pct}% off)` : ''}</span>
          <div class="muted" style="font-size:var(--text-xs)">${escapeHtml(o.delivery_address || 'No address')}</div>
        </div>
        <select class="select" data-order-status="${o.id}" style="width:auto">
          ${['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'].map(s => `<option value="${s}" ${o.status === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
      </div>`).join('');
    $$('[data-order-status]', el).forEach(sel => sel.addEventListener('change', async () => {
      await BR.data.updateOrderStatus(sel.dataset.orderStatus, sel.value);
      toast('Order updated', 'success');
    }));
  }

  function wireCoinGrantForm() {
    const btn = $('#adminGrantCoinsBtn');
    if (!btn || btn.dataset.wired) return;
    btn.dataset.wired = '1';
    btn.addEventListener('click', async () => {
      const username = $('#grantUsername').value.trim();
      const amount = parseInt($('#grantAmount').value);
      const reason = $('#grantReason').value.trim() || 'Admin grant';
      if (!username || !amount) { toast('Fill in username and amount', 'default', 'fa-triangle-exclamation'); return; }
      const res = await BR.data.adminGrantCoins(username, amount, reason);
      if (res.ok) { toast(res.note || 'Coins granted', 'success'); $('#grantUsername').value = ''; $('#grantAmount').value = ''; $('#grantReason').value = ''; }
      else toast(res.error || 'Failed', 'default', 'fa-triangle-exclamation');
    });
  }

  function wireAnnouncementForm() {
    const btn = $('#adminPublishAnnouncementBtn');
    if (!btn || btn.dataset.wired) return;
    btn.dataset.wired = '1';
    btn.addEventListener('click', async () => {
      const msg = $('#newAnnouncementText').value.trim();
      if (!msg) return;
      await BR.data.publishAnnouncement(msg);
      $('#newAnnouncementText').value = '';
      toast('Announcement published', 'success');
      document.dispatchEvent(new CustomEvent('br:data-refresh'));
    });
  }

  async function render() {
    if (BR.nav.current !== 'admin') return;
    renderSecurityNotice();
    renderDashboard();
    renderTournamentManager();
    wireCreateTournamentForm();
    renderOrderManager();
    wireCoinGrantForm();
    wireAnnouncementForm();
    renderScrimManager();
    renderTryoutManager();
    wireAddPlayerToTeamForm();
    wireScheduleTryoutForm();
  }

  function init() {
    document.addEventListener('br:admin-gate-tapped', promptGatePassword);
    document.addEventListener('br:tab-changed', (e) => { if (e.detail === 'admin') render(); });
  }

  return { init, render };
})();