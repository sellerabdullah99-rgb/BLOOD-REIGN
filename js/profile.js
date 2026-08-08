/* ==========================================================
   BLOOD REIGN — Profile Tab
   ========================================================== */

window.BR = window.BR || {};

BR.profile = (function () {
  const { $, $$, initials, formatCompact, toast, escapeHtml } = BR.utils;

  function renderHeader(profile) {
    const tier = BR.utils.vipTier(profile.coins);
    const el = $('#profileHeaderCard');
    if (!el) return;
    el.innerHTML = `
      <div class="avatar profile-avatar" style="border:3px solid ${tier.color}">${initials(profile.username)}</div>
      <h2 class="profile-username">${escapeHtml(profile.username)}</h2>
      <span class="badge" style="background:${tier.color}22;color:${tier.color};border:1px solid ${tier.color}66">
        <i class="fa-solid ${tier.icon}"></i> ${tier.label} TIER
      </span>
      ${profile.mode === 'guest' ? `<p class="muted" style="margin-top:8px;font-size:var(--text-xs)">Playing as guest — set up your identity below</p>` : ''}
      <button class="btn btn-outline btn-sm" id="editProfileBtn" style="margin-top:14px"><i class="fa-solid fa-pen"></i> Edit Profile</button>
    `;
    $('#editProfileBtn').addEventListener('click', () => openEditModal(profile));
  }

  function renderStats(profile) {
    const el = $('#profileStatsGrid');
    if (!el) return;
    const stats = [
      { label: 'Tournaments', value: profile.tournaments_joined, icon: 'fa-trophy' },
      { label: 'Wins', value: profile.total_wins, icon: 'fa-crown' },
      { label: 'Kills', value: formatCompact(profile.total_kills), icon: 'fa-skull' },
      { label: 'Coins', value: profile.coins, icon: 'fa-coins' },
    ];
    el.innerHTML = stats.map(s => `
      <div class="card stat-card">
        <i class="fa-solid ${s.icon}"></i>
        <div class="stat-value">${s.value}</div>
        <div class="muted stat-label">${s.label}</div>
      </div>`).join('');
  }

  function renderBadges(earnedKeys) {
    const el = $('#profileBadges');
    if (!el) return;
    el.innerHTML = BR.config.BADGES.map(b => {
      const earned = earnedKeys.includes(b.key);
      return `
      <div class="badge-tile ${earned ? '' : 'locked'}" title="${escapeHtml(b.desc)}">
        <i class="fa-solid ${b.icon}"></i>
        <span>${b.label}</span>
      </div>`;
    }).join('');
  }

  function openEditModal(profile) {
    BR.ui.openModal('editProfileModal', {
      title: 'Edit Profile',
      bodyHTML: `
        <label class="field-label">Username</label>
        <input class="input" id="editUsername" value="${escapeHtml(profile.username === 'Guest Warrior' ? '' : profile.username)}" placeholder="Choose a username" style="margin-bottom:12px">
        <label class="field-label">Free Fire UID</label>
        <input class="input" id="editFfUid" value="${escapeHtml(profile.ff_uid || '')}" placeholder="e.g. 123456789" inputmode="numeric" style="margin-bottom:16px">
        <div class="toggle-row" style="margin-bottom:20px">
          <span>Discord tournament alerts</span>
          <label class="switch">
            <input type="checkbox" id="editDiscordOptin" ${profile.discord_optin ? 'checked' : ''}>
            <span class="switch-track"></span>
          </label>
        </div>
        <button class="btn btn-primary btn-block" id="saveProfileBtn">Save Changes</button>
      `,
    });
    $('#saveProfileBtn').addEventListener('click', async () => {
      const username = $('#editUsername').value.trim();
      const ff_uid = $('#editFfUid').value.trim();
      const discord_optin = $('#editDiscordOptin').checked;
      if (!username) { toast('Enter a username', 'default', 'fa-triangle-exclamation'); return; }
      await BR.auth.updateProfileFields({ username, ff_uid, discord_optin });
      BR.ui.closeModal('editProfileModal');
      toast('Profile updated', 'success');
    });
  }

  function renderAccountSection(profile) {
    const el = $('#profileAccountSection');
    if (!el) return;

    if (!BR.isConfigured) {
      el.innerHTML = `<p class="muted" style="font-size:var(--text-sm)"><i class="fa-solid fa-plug-circle-xmark"></i> Running in local demo mode — connect Supabase to enable real accounts across devices.</p>`;
      return;
    }

    if (BR.auth.isLoggedIn()) {
      el.innerHTML = `<button class="btn btn-outline btn-block" id="logoutBtn"><i class="fa-solid fa-right-from-bracket"></i> Log Out</button>`;
      $('#logoutBtn').addEventListener('click', async () => { await BR.auth.signOut(); toast('Logged out'); });
    } else {
      el.innerHTML = `
        <div class="card">
          <div class="auth-tabs">
            <button class="auth-tab active" data-authtab="login">Log In</button>
            <button class="auth-tab" data-authtab="signup">Sign Up</button>
          </div>
          <div id="authFormWrap"></div>
        </div>`;
      renderAuthForm('login');
      $$('.auth-tab', el).forEach(t => t.addEventListener('click', () => {
        $$('.auth-tab', el).forEach(x => x.classList.toggle('active', x === t));
        renderAuthForm(t.dataset.authtab);
      }));
    }
  }

  function renderAuthForm(kind) {
    const wrap = $('#authFormWrap');
    wrap.innerHTML = `
      ${kind === 'signup' ? `<label class="field-label">Username</label><input class="input" id="authUsername" placeholder="FireStorm_PK" style="margin-bottom:10px">` : ''}
      <label class="field-label">Email</label>
      <input class="input" id="authEmail" type="email" placeholder="you@example.com" style="margin-bottom:10px">
      <label class="field-label">Password</label>
      <input class="input" id="authPassword" type="password" placeholder="••••••••" style="margin-bottom:16px">
      <button class="btn btn-primary btn-block" id="authSubmitBtn">${kind === 'signup' ? 'Create Account' : 'Log In'}</button>
    `;
    $('#authSubmitBtn').addEventListener('click', async () => {
      const email = $('#authEmail').value.trim();
      const password = $('#authPassword').value;
      if (!email || !password) { toast('Fill in all fields', 'default', 'fa-triangle-exclamation'); return; }
      const res = kind === 'signup'
        ? await BR.auth.signUp(email, password, $('#authUsername').value.trim() || 'Player')
        : await BR.auth.signIn(email, password);
      if (!res.ok) { toast(res.error, 'default', 'fa-triangle-exclamation'); return; }
      toast(kind === 'signup' ? 'Account created!' : 'Welcome back!', 'success');
      render();
    });
  }

  async function render() {
    const profile = BR.auth.getProfile();
    if (!profile) return;
    renderHeader(profile);
    renderStats(profile);
    renderBadges(BR.isConfigured ? [] : BR.guestStore.get().badges); // live badges fetch could be added via a query; kept simple here
    renderAccountSection(profile);
  }

  function init() {
    render();
    const supportBtn = $('#discordSupportBtn');
    if (supportBtn) supportBtn.href = BR.utils.discordInviteLink();
    document.addEventListener('br:profile-changed', render);
    document.addEventListener('br:tab-changed', (e) => { if (e.detail === 'profile') render(); });
  }

  return { init, render };
})();
