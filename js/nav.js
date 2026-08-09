/* ==========================================================
   BLOOD REIGN — Navigation
   Same tab state drives both the mobile bottom bar and the
   desktop inline header nav (see css/layout.css @1024px).
   ========================================================== */

window.BR = window.BR || {};

BR.nav = (function () {
  const { $, $$, ls } = BR.utils;
  const TABS = ['home', 'tournaments', 'shop', 'coins', 'leaderboard', 'profile'];
  let current = 'home';
  let adminUnlocked = false;
  let footerTapCount = 0;
  let footerTapTimer = null;

  function goTo(tab, opts = {}) {
    if (tab === 'admin' && !adminUnlocked) return;
    if (!TABS.includes(tab) && tab !== 'admin') return;

    current = tab;
    ls.set('bloodreign_lasttab', tab);

    $$('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `panel-${tab}`));
    $$('.nav-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));

    if (!opts.silent) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      document.dispatchEvent(new CustomEvent('br:tab-changed', { detail: tab }));
    }
  }

  function wireTabButtons() {
    $$('.nav-tab').forEach(btn => {
      btn.addEventListener('click', () => goTo(btn.dataset.tab));
    });
  }

  function wireAdminGate() {
    const trigger = $('#adminGateTrigger');
    if (!trigger) return;
    trigger.addEventListener('click', () => {
      footerTapCount += 1;
      clearTimeout(footerTapTimer);
      footerTapTimer = setTimeout(() => { footerTapCount = 0; }, 1500);
      if (footerTapCount >= 5) {
        footerTapCount = 0;
        document.dispatchEvent(new CustomEvent('br:admin-gate-tapped'));
      }
    });
  }

  function unlockAdminTab() {
    adminUnlocked = true;
    $$('.admin-nav-tab').forEach(btn => { btn.style.display = ''; });
  }

  function wireGotoLinks() {
    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-goto]');
      if (el) goTo(el.dataset.goto);
    });
  }

  function init() {
    wireTabButtons();
    wireAdminGate();
    wireGotoLinks();
    const last = ls.get('bloodreign_lasttab', 'home');
    goTo(TABS.includes(last) ? last : 'home', { silent: true });
    $$('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `panel-${current}`));
    $$('.nav-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === current));
  }

  return { init, goTo, unlockAdminTab, get current() { return current; } };
})();
