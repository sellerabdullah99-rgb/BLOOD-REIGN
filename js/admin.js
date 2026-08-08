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
          ${t.status !== 'COMPLETED' ? `<button class="btn btn-sm btn-outline" data-set-winner="${t.id}">Set Winner</button>` : ''}
          <button class="btn btn-sm btn-ghost" data-delete-tournament="${t.id}"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>`).join('');

    $$('[data-set-winner]', el).forEach(btn => btn.addEventListener('click', async () => {
      const username = prompt('Winner username:');
      if (!username) return;
      const res = await BR.data.adminSetWinner(btn.dataset.setWinner, username.trim());
      if (res.ok) { toast('Winner set — +100 coins granted', 'success'); renderTournamentManager(); renderDashboard(); }
      else toast(res.error || 'Failed', 'default', 'fa-triangle-exclamation');
    }));
    $$('[data-delete-tournament]', el).forEach(btn => btn.addEventListener('click', async () => {
      if (!confirm('Delete this tournament?')) return;
      await BR.data.adminDeleteTournament(btn.dataset.deleteTournament);
      renderTournamentManager();
    }));
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
