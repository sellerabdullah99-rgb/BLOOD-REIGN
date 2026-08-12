/* ==========================================================
   BLOOD REIGN — Utilities
   ========================================================== */

window.BR = window.BR || {};

BR.utils = (function () {
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  function formatPKR(amount) {
    return '₨' + Number(amount).toLocaleString('en-PK', { maximumFractionDigits: 0 });
  }

  function formatCompact(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return String(n);
  }

  function initials(name) {
    if (!name) return '??';
    const parts = name.trim().split(/\s+/);
    return (parts[0][0] + (parts[1] ? parts[1][0] : parts[0][1] || '')).toUpperCase();
  }

  function vipTier(coins) {
    return BR.config.VIP_TIERS.find(t => coins >= t.min && coins <= t.max) || BR.config.VIP_TIERS[0];
  }

  function nextVipTier(coins) {
    const idx = BR.config.VIP_TIERS.findIndex(t => coins >= t.min && coins <= t.max);
    return BR.config.VIP_TIERS[idx + 1] || null;
  }

  function starString(rating) {
    const full = Math.round(rating);
    return '★'.repeat(full) + '☆'.repeat(5 - full);
  }

  function debounce(fn, wait = 250) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  }

  function countdownParts(targetDate) {
    const diff = Math.max(0, new Date(targetDate).getTime() - Date.now());
    const s = Math.floor(diff / 1000);
    return {
      total: diff,
      d: Math.floor(s / 86400),
      h: Math.floor((s % 86400) / 3600),
      m: Math.floor((s % 3600) / 60),
      s: s % 60,
    };
  }

  function countdownString(targetDate) {
    const p = countdownParts(targetDate);
    if (p.total <= 0) return 'STARTED';
    if (p.d > 0) return `${p.d}d ${p.h}h ${p.m}m`;
    return `${String(p.h).padStart(2, '0')}:${String(p.m).padStart(2, '0')}:${String(p.s).padStart(2, '0')}`;
  }

  // Posts a message straight into the configured Discord channel via webhook.
  // Returns { ok: true } on success, { ok: false, error } if the webhook isn't
  // configured or the request fails (network, bad URL, rate limit, etc).
  async function sendDiscordWebhook(text) {
    const url = BR.config.DISCORD_WEBHOOK_URL;
    if (!url || url.includes('XXXXXXXXXX')) {
      return { ok: false, error: 'Discord webhook not configured yet.' };
    }
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text }),
      });
      if (!res.ok) return { ok: false, error: `Discord returned ${res.status}` };
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message || 'Network error' };
    }
  }

  function discordInviteLink() {
    return BR.config.DISCORD_INVITE_URL;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  // ---- localStorage (used for guest/local state that doesn't need Supabase) ----
  const ls = {
    get(key, fallback = null) {
      try {
        const v = localStorage.getItem(key);
        return v === null ? fallback : JSON.parse(v);
      } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
    },
    remove(key) { try { localStorage.removeItem(key); } catch {} },
  };

  // ---- Toast notifications ----
  function toast(message, type = 'default', icon = 'fa-circle-info') {
    const stack = $('#toastStack');
    if (!stack) return;
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-circle-check' : icon}"></i><span>${escapeHtml(message)}</span>`;
    stack.appendChild(el);
    setTimeout(() => {
      el.style.transition = 'opacity 300ms ease, transform 300ms ease';
      el.style.opacity = '0';
      el.style.transform = 'translateY(-8px)';
      setTimeout(() => el.remove(), 300);
    }, 2800);
  }

  // ---- Floating "+N coins" animation, anchored to an element or viewport center ----
  function floatCoins(amount, anchorEl) {
    const el = document.createElement('div');
    el.textContent = `${amount > 0 ? '+' : ''}${amount} 🪙`;
    el.style.cssText = `
      position: fixed; z-index: 400; font-family: var(--font-display);
      font-size: 1.4rem; color: var(--gold); letter-spacing: 1px;
      pointer-events: none; text-shadow: 0 0 12px #c9a84c99;
      animation: float-up 1.1s ease-out forwards;
    `;
    const rect = anchorEl ? anchorEl.getBoundingClientRect() : { left: window.innerWidth / 2, top: window.innerHeight / 2, width: 0 };
    el.style.left = `${rect.left + rect.width / 2}px`;
    el.style.top = `${rect.top}px`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1200);
  }

  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }

  return {
    $, $$, formatPKR, formatCompact, initials, vipTier, nextVipTier, starString,
    debounce, countdownParts, countdownString, sendDiscordWebhook, discordInviteLink, escapeHtml, ls, toast,
    floatCoins, todayStr,
  };
})();
