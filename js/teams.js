/* ==========================================================
   BLOOD REIGN — Teams (My Team roster)
   Rendered inside the Profile tab. Only the captain can manage
   the roster — real protection is RLS (is_team_captain()) when
   Supabase is configured.
   ========================================================== */

window.BR = window.BR || {};

BR.teams = (function () {
  const { $, $$, escapeHtml, toast } = BR.utils;

  const ROLE_ICONS = { IGL: 'fa-chess-king', RUSHER: 'fa-bolt', ASSAULTER: 'fa-crosshairs', SNIPER: 'fa-binoculars', SUPPORT: 'fa-hand-holding-medical', SUBSTITUTE: 'fa-rotate' };

  function roleIcon(role) { return ROLE_ICONS[role] || 'fa-user'; }

  function renderNoTeam() {
    const el = $('#myTeamSection');
    el.innerHTML = `
      <div class="card text-center" style="padding:var(--space-8) var(--space-4)">
        <i class="fa-solid fa-people-group" style="font-size:2rem;color:var(--steel);margin-bottom:12px"></i>
        <h3 style="margin-bottom:8px">No team yet</h3>
        <p class="muted" style="font-size:var(--text-sm);margin-bottom:16px">Create a squad to register for DUO/SQUAD tournaments, post tryouts, and schedule scrims.</p>
        <button class="btn btn-primary" id="createTeamBtn"><i class="fa-solid fa-plus"></i> Create Team</button>
      </div>`;
    $('#createTeamBtn').addEventListener('click', openCreateTeamModal);
  }

  function renderTeam(team) {
    const el = $('#myTeamSection');
    const isCaptain = team.members.some(m => m.is_captain && (m.profile_id === BR.auth.getProfile()?.id || !BR.isConfigured));
    el.innerHTML = `
      <div class="card" style="margin-bottom:16px">
        <div class="flex items-center justify-between mb-2">
          <div><strong style="font-size:var(--text-lg)">${escapeHtml(team.name)}</strong> <span class="badge badge-steel">${escapeHtml(team.tag)}</span></div>
          <span class="muted" style="font-size:var(--text-xs)">${team.members.length}/6 roster</span>
        </div>
        <div class="muted" style="font-size:var(--text-sm)"><i class="fa-solid fa-location-dot"></i> ${escapeHtml(team.region || 'Pakistan')}</div>
      </div>
      <div class="grid-1" id="rosterList" style="margin-bottom:16px"></div>
      ${isCaptain && team.members.length < 6 ? `<button class="btn btn-outline btn-block" id="addMemberBtn"><i class="fa-solid fa-user-plus"></i> Add Roster Member</button>` : ''}
    `;

    const rosterEl = $('#rosterList');
    rosterEl.innerHTML = team.members.map(m => `
      <div class="card admin-row">
        <div class="flex items-center gap-3">
          <div class="avatar" style="width:38px;height:38px;font-size:13px">${BR.utils.initials(m.ign)}</div>
          <div>
            <strong>${escapeHtml(m.ign)}</strong> ${m.is_captain ? '<i class="fa-solid fa-crown" style="color:var(--gold);font-size:11px"></i>' : ''}
            <div class="muted" style="font-size:var(--text-xs)">${escapeHtml(m.full_name)}</div>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <span class="badge badge-outline-red"><i class="fa-solid ${roleIcon(m.role)}"></i> ${m.role}</span>
          ${isCaptain && !m.is_captain ? `<button class="btn btn-sm btn-ghost" data-remove-member="${m.id}"><i class="fa-solid fa-trash"></i></button>` : ''}
        </div>
      </div>`).join('');

    $$('[data-remove-member]', rosterEl).forEach(btn => btn.addEventListener('click', async () => {
      if (!confirm('Remove this player from the roster?')) return;
      await BR.data.removeTeamMember(btn.dataset.removeMember, team.id);
      toast('Player removed', 'success');
      render();
    }));

    const addBtn = $('#addMemberBtn');
    if (addBtn) addBtn.addEventListener('click', () => openAddMemberModal(team.id));
  }

  function openCreateTeamModal() {
    const profile = BR.auth.getProfile();
    BR.ui.openModal('createTeamModal', {
      title: 'Create Your Team',
      bodyHTML: `
        <label class="field-label">Team Name</label>
        <input class="input" id="teamName" placeholder="e.g. Karachi Titans" style="margin-bottom:12px">
        <label class="field-label">Team Tag</label>
        <input class="input" id="teamTag" placeholder="e.g. KT" maxlength="5" style="margin-bottom:16px">
        <p class="field-label" style="margin-bottom:8px">Your Roster Details (as captain)</p>
        <label class="field-label">Full Name</label>
        <input class="input" id="captainFullName" style="margin-bottom:12px">
        <label class="field-label">In-game Username (IGN)</label>
        <input class="input" id="captainIgn" value="${escapeHtml(profile?.ign || (profile?.username && profile.username !== 'Guest Warrior' ? profile.username : ''))}" style="margin-bottom:12px">
        <label class="field-label">Free Fire UID</label>
        <input class="input" id="captainFfUid" value="${escapeHtml(profile?.ff_uid || '')}" inputmode="numeric" style="margin-bottom:12px">
        <label class="field-label">Your Role</label>
        <select class="select" id="captainRole" style="margin-bottom:20px">
          ${['IGL','RUSHER','ASSAULTER','SNIPER','SUPPORT','SUBSTITUTE'].map(r =>
            `<option value="${r}" ${(profile?.primary_role || 'ASSAULTER') === r ? 'selected' : ''}>${r === 'IGL' ? 'IGL (In-Game Leader)' : r.charAt(0) + r.slice(1).toLowerCase()}</option>`
          ).join('')}
        </select>
        <button class="btn btn-primary btn-block" id="confirmCreateTeamBtn">Create Team</button>
      `,
    });
    $('#confirmCreateTeamBtn').addEventListener('click', async () => {
      const name = $('#teamName').value.trim();
      const tag = $('#teamTag').value.trim();
      const fullName = $('#captainFullName').value.trim();
      const ign = $('#captainIgn').value.trim();
      const ffUid = $('#captainFfUid').value.trim();
      const role = $('#captainRole').value;
      if (!name || !tag || !fullName || !ign) { toast('Fill in all fields', 'default', 'fa-triangle-exclamation'); return; }
      if (BR.isConfigured && !BR.auth.isLoggedIn()) { toast('Sign in first (below) to create a team', 'default', 'fa-circle-info'); return; }

      const res = await BR.data.createTeam(name, tag, { fullName, ign, ffUid, role });
      if (!res.ok) { toast(res.error === 'tag_taken' ? 'That tag is already used' : res.error === 'already_have_team' ? 'You already have a team' : 'Could not create team', 'default', 'fa-triangle-exclamation'); return; }
      BR.ui.closeModal('createTeamModal');
      toast('Team created!', 'success');
      render();
    });
  }

  function openAddMemberModal(teamId) {
    BR.ui.openModal('addMemberModal', {
      title: 'Add Roster Member',
      bodyHTML: `
        <label class="field-label">Full Name</label>
        <input class="input" id="memberFullName" style="margin-bottom:12px">
        <label class="field-label">In-game Username (IGN)</label>
        <input class="input" id="memberIgn" style="margin-bottom:12px">
        <label class="field-label">Free Fire UID</label>
        <input class="input" id="memberFfUid" inputmode="numeric" style="margin-bottom:12px">
        <label class="field-label">Role</label>
        <select class="select" id="memberRole" style="margin-bottom:20px">
          <option value="IGL">IGL</option><option value="RUSHER">Rusher</option>
          <option value="ASSAULTER" selected>Assaulter</option><option value="SNIPER">Sniper</option>
          <option value="SUPPORT">Support</option><option value="SUBSTITUTE">Substitute</option>
        </select>
        <button class="btn btn-primary btn-block" id="confirmAddMemberBtn">Add to Roster</button>
      `,
    });
    $('#confirmAddMemberBtn').addEventListener('click', async () => {
      const fullName = $('#memberFullName').value.trim();
      const ign = $('#memberIgn').value.trim();
      const ffUid = $('#memberFfUid').value.trim();
      const role = $('#memberRole').value;
      if (!fullName || !ign) { toast('Fill in name and IGN', 'default', 'fa-triangle-exclamation'); return; }
      const res = await BR.data.addTeamMember(teamId, fullName, ign, ffUid, role);
      if (!res.ok) { toast(res.error === 'roster_full' ? 'Roster is full (max 6)' : res.error === 'ign_taken_on_team' ? 'That IGN is already on your roster' : 'Could not add member', 'default', 'fa-triangle-exclamation'); return; }
      BR.ui.closeModal('addMemberModal');
      toast('Member added', 'success');
      render();
    });
  }

  async function render() {
    const el = $('#myTeamSection');
    if (!el) return;
    const team = await BR.data.getMyTeam();
    if (!team) renderNoTeam(); else renderTeam(team);
  }

  function init() {
    document.addEventListener('br:tab-changed', (e) => { if (e.detail === 'profile') render(); });
    document.addEventListener('br:profile-changed', () => { if (BR.nav.current === 'profile') render(); });
  }

  return { init, render };
})();
