/* ==========================================================
   BLOOD REIGN — Coins Tab
   ========================================================== */

window.BR = window.BR || {};

BR.coins = (function () {
  const { $, $$, formatCompact, toast, floatCoins } = BR.utils;

  function renderBalance(profile) {
    const el = $('#coinsBalanceDisplay');
    if (el) el.textContent = (profile?.coins || 0).toLocaleString();
    const tier = BR.utils.vipTier(profile?.coins || 0);
    const nextTier = BR.utils.nextVipTier(profile?.coins || 0);
    const tierEl = $('#vipTierChip');
    if (tierEl) {
      tierEl.innerHTML = `<i class="fa-solid ${tier.icon}"></i> ${tier.label} TIER`;
      tierEl.style.color = tier.color;
    }
    const progressEl = $('#vipProgress');
    const progressLabel = $('#vipProgressLabel');
    if (progressEl && nextTier) {
      const span = nextTier.min - tier.min;
      const pct = Math.min(100, Math.round(((profile.coins - tier.min) / span) * 100));
      progressEl.style.width = `${pct}%`;
      if (progressLabel) progressLabel.textContent = `${nextTier.min - profile.coins} coins to ${nextTier.label}`;
    } else if (progressEl) {
      progressEl.style.width = '100%';
      if (progressLabel) progressLabel.textContent = 'Max tier reached 🎉';
    }
  }

  function renderEarnActions(profile) {
    const el = $('#earnActionsList');
    if (!el) return;
    const actions = [
      { key: 'ad', icon: 'fa-play', label: 'Watch Ad', sub: 'Up to 5 per day', amount: '+10' },
      { key: 'daily', icon: 'fa-calendar-check', label: 'Daily Login', sub: `${profile?.current_streak || 0} day streak`, amount: '+5' },
      { key: 'share', icon: 'fa-share-nodes', label: 'Share a Tournament', sub: 'Once per share', amount: '+15' },
    ];
    el.innerHTML = actions.map(a => `
      <button class="card card-hover earn-action-row" data-earn="${a.key}">
        <div class="earn-icon"><i class="fa-solid ${a.icon}"></i></div>
        <div class="earn-text"><strong>${a.label}</strong><span class="muted">${a.sub}</span></div>
        <div class="earn-amount">${a.amount} 🪙</div>
      </button>`).join('');
    $$('[data-earn]', el).forEach(btn => btn.addEventListener('click', () => handleEarn(btn.dataset.earn, btn)));
  }

  async function handleEarn(key, anchorEl) {
    if (key === 'ad') {
      return handleWatchAd(anchorEl);
    } else if (key === 'daily') {
      const res = await BR.data.claimDailyLogin();
      handleEarnResult(res, 5, anchorEl);
    } else if (key === 'share') {
      const text = '🔥 Check out BLOOD REIGN tournaments — free entry, real prizes!';
      try { await navigator.clipboard.writeText(text); toast('Copied! Paste it in a Discord server 👇', 'default', 'fa-copy'); } catch (_) {}
      window.open(BR.utils.discordInviteLink(), '_blank');
      const res = await BR.data.earnShareBonus();
      handleEarnResult(res, 15, anchorEl);
    }
  }

  // Opens the real Adsterra ad in a new tab, then requires a short wait
  // before coins can be claimed — Direct Links can't confirm the ad was
  // actually watched, so this at least stops an instant no-look claim.
  // Injects the Adsterra popunder script — it auto-fires on the user's
  // next click. Note: Adsterra frequency-caps popunders (usually once
  // every several hours per browser), so it won't necessarily open every
  // single time — that's the ad network's own anti-spam limit, not a bug.
  function triggerPopunderAd() {
    const src = BR.config.ADSTERRA_POPUNDER_SRC;
    if (!src || src.includes('YOUR-')) return false;
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    document.body.appendChild(s);
    return true;
  }

  function handleWatchAd(anchorEl) {
    const triggered = triggerPopunderAd();
    if (!triggered) {
      toast('Ad network not connected yet — add your Adsterra script in config.js', 'default', 'fa-triangle-exclamation');
      return;
    }
    const original = anchorEl.innerHTML;
    anchorEl.style.pointerEvents = 'none';
    let secondsLeft = 15;
    const amountEl = anchorEl.querySelector('.earn-amount');
    if (amountEl) amountEl.textContent = `Wait ${secondsLeft}s…`;

    const tick = setInterval(() => {
      secondsLeft -= 1;
      if (amountEl) amountEl.textContent = secondsLeft > 0 ? `Wait ${secondsLeft}s…` : 'Claim now';
      if (secondsLeft <= 0) {
        clearInterval(tick);
        anchorEl.style.pointerEvents = '';
        anchorEl.dataset.earn = 'ad_claim';
        const newBtn = anchorEl.cloneNode(true);
        anchorEl.replaceWith(newBtn);
        newBtn.addEventListener('click', async () => {
          newBtn.style.pointerEvents = 'none';
          const res = await BR.data.watchAd();
          await handleEarnResult(res, 10, newBtn);
          newBtn.innerHTML = original;
          newBtn.dataset.earn = 'ad';
          newBtn.style.pointerEvents = '';
          newBtn.addEventListener('click', () => handleEarn('ad', newBtn));
        });
      }
    }, 1000);
  }

  async function handleEarnResult(res, amount, anchorEl) {
    if (!res.ok) {
      const msg = res.error === 'daily_limit_reached' ? 'Daily ad limit reached — come back tomorrow'
        : res.error === 'already_claimed' ? 'Already claimed today ✅'
        : 'Could not complete — try again';
      toast(msg, 'default', 'fa-circle-info');
      return;
    }
    if (amount && anchorEl) floatCoins(amount, anchorEl);
    toast('Coins added!', 'success');
    await BR.auth.refreshProfile();
  }

  function renderRewards(profile) {
    const cosmeticsEl = $('#cosmeticRewardsGrid');
    const discountsEl = $('#discountRewardsGrid');
    const coins = profile?.coins || 0;
    if (cosmeticsEl) cosmeticsEl.innerHTML = BR.config.COSMETIC_REWARDS.map(r => rewardCardHTML(r, coins)).join('');
    if (discountsEl) discountsEl.innerHTML = BR.config.DISCOUNT_REWARDS.map(r => rewardCardHTML(r, coins)).join('');
    $$('[data-redeem]').forEach(btn => btn.addEventListener('click', () => handleRedeem(btn.dataset.redeem, btn.dataset.cost, btn.dataset.label)));
  }

  function rewardCardHTML(r, coins) {
    const affordable = coins >= r.cost;
    return `
    <div class="card reward-card ${affordable ? '' : 'locked'}">
      <i class="fa-solid ${r.icon}"></i>
      <strong>${r.label}</strong>
      <span class="muted">${r.cost} coins</span>
      <button class="btn ${affordable ? 'btn-gold' : 'btn-ghost'} btn-sm btn-block" data-redeem="${r.key}" data-cost="${r.cost}" data-label="${r.label}" ${affordable ? '' : 'disabled'}>
        ${affordable ? 'Redeem' : '<i class="fa-solid fa-lock"></i> Locked'}
      </button>
    </div>`;
  }

  async function handleRedeem(key, cost, label) {
    const res = await BR.data.redeemReward(key, parseInt(cost), label);
    if (!res.ok) { toast('Not enough coins', 'default', 'fa-triangle-exclamation'); return; }
    toast(`Redeemed: ${label}`, 'success');
    await BR.auth.refreshProfile();
  }

  function renderHistory(transactions) {
    const el = $('#coinHistoryList');
    if (!el) return;
    if (!transactions.length) { el.innerHTML = `<div class="empty-state"><p>No activity yet — start earning above!</p></div>`; return; }
    el.innerHTML = transactions.map(t => `
      <div class="history-row">
        <span class="${t.amount > 0 ? 'positive' : 'negative'}">${t.amount > 0 ? '+' : ''}${t.amount}</span>
        <span class="history-reason">${BR.utils.escapeHtml(t.reason)}</span>
        <span class="muted history-date">${new Date(t.created_at).toLocaleDateString()}</span>
      </div>`).join('');
  }

  async function render() {
    const profile = BR.auth.getProfile();
    renderBalance(profile);
    renderEarnActions(profile);
    renderRewards(profile);
    renderHistory(await BR.data.getCoinTransactions());
  }

  function init() {
    render();
    document.addEventListener('br:profile-changed', render);
    document.addEventListener('br:tab-changed', (e) => { if (e.detail === 'coins') render(); });
  }

  return { init, render };
})();
