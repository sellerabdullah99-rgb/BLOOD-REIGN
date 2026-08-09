/* ==========================================================
   BLOOD REIGN — Tryouts
   Sub-section of the Tournaments tab. Captains post open roster
   slots; anyone can apply; captains accept/reject from their
   own team's applications (accepting auto-adds to the roster).
   ========================================================== */

window.BR = window.BR || {};

BR.tryouts = (function () {
  const { $, $$, escapeHtml, toast } = BR.utils;
  let myTeam = null;
  let openTryouts = [];

  function renderHeader() {
    const el = $('#tryoutsHeader');
    if (!el) return;
    el.innerHTML = myTeam
      ? `<button class="btn btn-primary btn-block" id="postTryoutBtn"><i class="fa-solid fa-bullhorn"></i> Post a Tryout</button>`
      : `<p class="muted" style="font-size:var(--text-sm);margin-bottom:8px"><i class="fa-solid fa-circle-info"></i> Create a team in Profile → My Team to recruit players.</p>`;
    const btn = $('#postTryoutBtn');
    if (btn) btn.addEventListener('click', openPostModal);
  }

  function cardHTML(t) {
    const isMine = myTeam && t.team_id === myTeam.id;
    return `
    <div class="card card-hover" data-tryout-id="${t.id}">
      <div class="flex items-center justify-between mb-2">
        <span class="badge badge-outline-red">${escapeHtml(t.role_needed)} WANTED</span>
        ${isMine ? `<button class="btn btn-sm btn-ghost" data-close-tryout="${t.id}">Close</button>` : ''}
      </div>
      <strong>${escapeHtml(t.team_name || 'Team')} ${t.team_tag ? `[${escapeHtml(t.team_tag)}]` : ''}</strong>
      ${t.description ? `<p class="muted" style="font-size:var(--text-sm);margin-top:6px">${escapeHtml(t.description)}</p>` : ''}
      ${isMine
        ? `<div class="tryout-applications" data-apps-for="${t.id}" style="margin-top:12px"></div>`
        : `<button class="btn btn-outline btn-block" data-apply-tryout="${t.id}" style="margin-top:12px">Apply</button>`}
    </div>`;
  }

  async function renderApplicationsFor(tryoutId, container) {
    const apps = await BR.data.getMyTeamApplications(myTeam.id);
    const forThis = apps.filter(a => a.tryout_id === tryoutId && a.status === 'PENDING');
    if (!forThis.length) { container.innerHTML = `<p class="muted" style="font-size:var(--text-xs)">No applications yet.</p>`; return; }
    container.innerHTML = forThis.map(a => `
      <div class="admin-row" style="padding:8px 0">
        <div><strong>${escapeHtml(a.ign)}</strong><span class="muted"> — ${escapeHtml(a.full_name)}</span></div>
        <div class="admin-row-actions">
          <button class="btn btn-sm btn-success" data-accept-app="${a.id}"><i class="fa-solid fa-check"></i></button>
          <button class="btn btn-sm btn-ghost" data-reject-app="${a.id}"><i class="fa-solid fa-xmark"></i></button>
        </div>
      </div>`).join('');
    $$('[data-accept-app]', container).forEach(btn => btn.addEventListener('click', () => respond(btn.dataset.acceptApp, 'ACCEPTED')));
    $$('[data-reject-app]', container).forEach(btn => btn.addEventListener('click', () => respond(btn.dataset.rejectApp, 'REJECTED')));
  }

  async function respond(applicationId, status) {
    const res = await BR.data.respondToTryout(applicationId, status);
    if (res.ok) { toast(status === 'ACCEPTED' ? 'Player added to roster!' : 'Application declined', 'success'); render(); }
  }

  function wireCardActions(container) {
    $$('[data-apply-tryout]', container).forEach(btn => btn.addEventListener('click', () => openApplyModal(btn.dataset.applyTryout)));
    $$('[data-close-tryout]', container).forEach(btn => btn.addEventListener('click', async () => {
      if (!confirm('Close this tryout?')) return;
      await BR.data.closeTryout(btn.dataset.closeTryout);
      toast('Tryout closed', 'success');
      render();
    }));
    $$('[data-apps-for]', container).forEach(el => renderApplicationsFor(el.dataset.appsFor, el));
  }

  function renderList() {
    const el = $('#tryoutsList');
    if (!el) return;
    if (!openTryouts.length) {
      el.innerHTML = `<div class="empty-state"><i class="fa-solid fa-people-group"></i><h3>No open tryouts</h3><p>Check back soon or post one for your own team.</p></div>`;
      return;
    }
    el.innerHTML = `<div class="grid-1 stagger">${openTryouts.map(cardHTML).join('')}</div>`;
    wireCardActions(el);
  }

  function openPostModal() {
    BR.ui.openModal('postTryoutModal', {
      title: 'Post a Tryout',
      bodyHTML: `
        <label class="field-label">Role Needed</label>
        <select class="select" id="tryoutRole" style="margin-bottom:12px">
          <option value="IGL">IGL</option><option value="RUSHER">Rusher</option>
          <option value="ASSAULTER">Assaulter</option><option value="SNIPER">Sniper</option>
          <option value="SUPPORT">Support</option><option value="SUBSTITUTE">Substitute</option>
        </select>
        <label class="field-label">Description (optional)</label>
        <textarea class="textarea" id="tryoutDesc" rows="3" placeholder="What are you looking for?" style="margin-bottom:20px"></textarea>
        <button class="btn btn-primary btn-block" id="confirmPostTryoutBtn">Post Tryout</button>
      `,
    });
    $('#confirmPostTryoutBtn').addEventListener('click', async () => {
      const role = $('#tryoutRole').value;
      const desc = $('#tryoutDesc').value.trim();
      const res = await BR.data.createTryout(myTeam.id, role, desc);
      if (!res.ok) { toast('Could not post tryout', 'default', 'fa-triangle-exclamation'); return; }
      BR.ui.closeModal('postTryoutModal');
      toast('Tryout posted', 'success');
      render();
    });
  }

  function openApplyModal(tryoutId) {
    const profile = BR.auth.getProfile();
    if (BR.isConfigured && !BR.auth.isLoggedIn()) {
      toast('Sign in from Profile to apply', 'default', 'fa-circle-info');
      return;
    }
    BR.ui.openModal('applyTryoutModal', {
      title: 'Apply for Tryout',
      bodyHTML: `
        <label class="field-label">Full Name</label>
        <input class="input" id="applyFullName" style="margin-bottom:12px">
        <label class="field-label">In-game Username (IGN)</label>
        <input class="input" id="applyIgn" value="${escapeHtml(profile?.username && profile.username !== 'Guest Warrior' ? profile.username : '')}" style="margin-bottom:12px">
        <label class="field-label">Free Fire UID</label>
        <input class="input" id="applyFfUid" value="${escapeHtml(profile?.ff_uid || '')}" inputmode="numeric" style="margin-bottom:12px">
        <label class="field-label">Message (optional)</label>
        <textarea class="textarea" id="applyMessage" rows="2" style="margin-bottom:20px"></textarea>
        <button class="btn btn-primary btn-block" id="confirmApplyBtn">Send Application</button>
      `,
    });
    $('#confirmApplyBtn').addEventListener('click', async () => {
      const fullName = $('#applyFullName').value.trim();
      const ign = $('#applyIgn').value.trim();
      const ffUid = $('#applyFfUid').value.trim();
      const message = $('#applyMessage').value.trim();
      if (!fullName || !ign) { toast('Fill in your name and IGN', 'default', 'fa-triangle-exclamation'); return; }
      const res = await BR.data.applyToTryout(tryoutId, fullName, ign, ffUid, message);
      if (!res.ok) { toast('Could not send application', 'default', 'fa-triangle-exclamation'); return; }
      BR.ui.closeModal('applyTryoutModal');
      toast('Application sent!', 'success');
    });
  }

  async function render() {
    myTeam = await BR.data.getMyTeam();
    openTryouts = await BR.data.getOpenTryouts();
    renderHeader();
    renderList();
  }

  function init() {
    document.addEventListener('br:tourney-section-changed', (e) => { if (e.detail === 'tryouts') render(); });
    document.addEventListener('br:profile-changed', () => { if (BR.nav.current === 'tournaments') render(); });
  }

  return { init, render };
})();
