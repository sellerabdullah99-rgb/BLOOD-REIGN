/* ==========================================================
   BLOOD REIGN — Shop Tab
   ========================================================== */

window.BR = window.BR || {};

BR.shop = (function () {
  const { $, $$, escapeHtml, starString, sendDiscordWebhook, toast, debounce } = BR.utils;
  let activeCategory = 'All';
  let searchTerm = '';
  let currentProducts = [];

  function cardHTML(p, opts = {}) {
    return `
    <div class="card card-hover product-card ${opts.compact ? 'compact' : ''}" data-product-id="${p.id}">
      <div class="product-thumb">
        ${p.image_url ? `
          <img src="${escapeHtml(p.image_url)}" alt="${escapeHtml(p.name)}" loading="lazy"
               onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
          <div class="product-thumb-fallback" style="display:none"><i class="fa-solid fa-bag-shopping"></i></div>
        ` : `<i class="fa-solid fa-bag-shopping"></i>`}
        ${p.tag ? `<span class="badge ${p.tag === 'HOT' ? 'badge-red' : 'badge-green'} product-tag">${p.tag}</span>` : ''}
      </div>
      <div class="product-brand">${escapeHtml(p.brand)}</div>
      <h4 class="product-name">${escapeHtml(p.name)}</h4>
      <div class="stars">${starString(p.rating)} <span class="muted">${p.rating}</span></div>
      <div class="product-bottom">
        <span class="product-price">🪙 ${(p.coin_price || 0).toLocaleString()}</span>
        <button class="btn btn-icon btn-primary" data-buy-product="${p.id}" aria-label="Order ${escapeHtml(p.name)}">
          <i class="fa-brands fa-discord"></i>
        </button>
      </div>
    </div>`;
  }

  function wireCardButtons(container) {
    $$('[data-buy-product]', container).forEach(btn => {
      btn.addEventListener('click', () => {
        const p = currentProducts.find(p => p.id === btn.dataset.buyProduct) || BR.mockData.products.find(p => p.id === btn.dataset.buyProduct);
        if (p) openOrderModal(p);
      });
    });
  }

  function renderCategoryPills() {
    const wrap = $('#shopCategoryPills');
    if (!wrap) return;
    wrap.innerHTML = BR.config.CATEGORIES.map(c => `<button class="pill-filter ${c === activeCategory ? 'active' : ''}" data-cat="${c}">${c}</button>`).join('');
    $$('[data-cat]', wrap).forEach(btn => btn.addEventListener('click', () => { activeCategory = btn.dataset.cat; render(); }));
  }

  function renderGrid() {
    const el = $('#shopGrid');
    if (!el) return;
    if (!currentProducts.length) {
      el.innerHTML = `<div class="empty-state"><i class="fa-solid fa-bag-shopping"></i><h3>No products found</h3><p>Try a different search or category.</p></div>`;
      return;
    }
    el.innerHTML = `<div class="grid-2 stagger">${currentProducts.map(p => cardHTML(p)).join('')}</div>`;
    wireCardButtons(el);
  }

  function openOrderModal(product) {
    const profile = BR.auth.getProfile();
    const coins = profile?.coins || 0;
    const price = product.coin_price || 0;
    const canAfford = coins >= price;

    BR.ui.openModal('orderModal', {
      title: 'Confirm Order',
      bodyHTML: `
        <div class="card" style="margin-bottom:16px">
          <h4 style="margin-bottom:4px">${escapeHtml(product.name)}</h4>
          <div class="muted" style="margin-bottom:8px">${escapeHtml(product.brand)} • ${escapeHtml(product.category)}</div>
          <div class="product-price" style="font-size:var(--text-xl)">🪙 ${price.toLocaleString()}</div>
        </div>
        <p class="muted" style="margin-bottom:14px;font-size:var(--text-sm)">Your balance: <strong>🪙 ${coins.toLocaleString()}</strong>${canAfford ? '' : ` — you need ${(price - coins).toLocaleString()} more. Earn coins in the Coins tab.`}</p>
        <label class="field-label">Delivery Address</label>
        <textarea class="textarea" id="orderAddress" rows="3" placeholder="House #, Street, Area, City" style="margin-bottom:20px"></textarea>
        <button class="btn btn-primary btn-block" id="confirmOrderBtn" ${canAfford ? '' : 'disabled'}><i class="fa-brands fa-discord"></i> ${canAfford ? 'BUY WITH COINS' : 'NOT ENOUGH COINS'}</button>
      `,
    });

    const confirmBtn = $('#confirmOrderBtn');
    if (!canAfford) return;

    confirmBtn.addEventListener('click', async () => {
      const address = $('#orderAddress').value.trim();
      if (!address) { toast('Add a delivery address', 'default', 'fa-triangle-exclamation'); return; }

      const res = await BR.data.buyProductWithCoins(product.id, address);
      if (!res.ok) {
        const msg = res.error === 'insufficient_coins' ? 'Not enough coins' : (res.error || 'Could not complete purchase');
        toast(msg, 'default', 'fa-triangle-exclamation');
        return;
      }
      await BR.auth.refreshProfile();

      const text = `🛍️ **BLOOD REIGN ORDER**\nProduct: ${product.name}\nPaid: 🪙 ${price.toLocaleString()} coins\nDelivery: ${address}`;
      const sent = await sendDiscordWebhook(text);
      BR.ui.closeModal('orderModal');
      toast(sent.ok ? "Order placed! We'll confirm on Discord" : 'Order placed! (Discord notify failed — we still got it)', sent.ok ? 'success' : 'default');
      document.dispatchEvent(new CustomEvent('br:data-refresh'));
    });
  }

  async function render() {
    currentProducts = await BR.data.getProducts(activeCategory, searchTerm);
    renderCategoryPills();
    renderGrid();
  }

  function wireSearch() {
    const input = $('#shopSearchInput');
    if (!input) return;
    input.addEventListener('input', debounce(() => { searchTerm = input.value.trim(); render(); }, 300));
  }

  function init() {
    wireSearch();
    render();
    document.addEventListener('br:tab-changed', (e) => { if (e.detail === 'shop') BR.guestStore?.markShopVisited?.(); });
    document.addEventListener('br:data-refresh', render);
  }

  return { init, render, cardHTML, wireCardButtons };
})();
