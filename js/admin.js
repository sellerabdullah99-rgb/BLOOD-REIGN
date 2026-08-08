/* ==========================================================
   BLOOD REIGN — Admin Panel
   UI access is gated by 5 taps on the footer mark + a local
   passcode (js/config.js). That only reveals the tab — real
   protection is the is_admin flag + RLS policies in Supabase,
   which must be set manually in the dashboard for security.
   ========================================================== */

window.BR = window.BR || {};

BR.admin = (function () {
  const { $, $$, formatPKR, escapeHtml, toast } = BR.utils;

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
          ${t.status !== 'COMPLETED' ? `<button class="btn btn-sm btn-outline" data-complete-tournament="${t.id}">Complete Tournament</button>` : ''}
          <button class="btn btn-sm btn-ghost" data-delete-tournament="${t.id}"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>`).join('');

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
  }

  function init() {
    document.addEventListener('br:admin-gate-tapped', promptGatePassword);
    document.addEventListener('br:tab-changed', (e) => { if (e.detail === 'admin') render(); });
  }

  return { init, render };
})();
