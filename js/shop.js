/* ==========================================================
   BLOOD REIGN — Shop Tab
   ========================================================== */

window.BR = window.BR || {};

BR.shop = (function () {
  const { $, $$, escapeHtml, formatPKR, starString, sendDiscordWebhook, toast, debounce } = BR.utils;
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
        <span class="product-price">${formatPKR(p.price)}</span>
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
    const applicableDiscounts = BR.config.DISCOUNT_REWARDS.filter(r => r.cost <= coins);

    BR.ui.openModal('orderModal', {
      title: 'Confirm Order',
      bodyHTML: `
        <div class="card" style="margin-bottom:16px">
          <h4 style="margin-bottom:4px">${escapeHtml(product.name)}</h4>
          <div class="muted" style="margin-bottom:8px">${escapeHtml(product.brand)} • ${escapeHtml(product.category)}</div>
          <div class="product-price" style="font-size:var(--text-xl)">${formatPKR(product.price)}</div>
        </div>
        <label class="field-label">Delivery Address</label>
        <textarea class="textarea" id="orderAddress" rows="3" placeholder="House #, Street, Area, City" style="margin-bottom:14px"></textarea>
        ${applicableDiscounts.length ? `
          <label class="field-label">Use a Coin Discount (optional)</label>
          <select class="select" id="orderDiscount" style="margin-bottom:16px">
            <option value="">No discount</option>
            ${applicableDiscounts.map(d => `<option value="${d.key}|${d.cost}|${d.label}">${d.label} — ${d.cost} coins</option>`).join('')}
          </select>` : `<p class="muted" style="margin-bottom:16px;font-size:var(--text-sm)">You have ${coins} coins. Earn more in the Coins tab to unlock order discounts.</p>`}
        <button class="btn btn-primary btn-block" id="confirmOrderBtn"><i class="fa-brands fa-discord"></i> PLACE ORDER</button>
      `,
    });

    $('#confirmOrderBtn').addEventListener('click', async () => {
      const address = $('#orderAddress').value.trim();
      if (!address) { toast('Add a delivery address', 'default', 'fa-triangle-exclamation'); return; }

      const discountSel = $('#orderDiscount');
      let discountPct = 0, coinsUsed = 0, discountLabel = '';
      if (discountSel && discountSel.value) {
        const [key, cost, label] = discountSel.value.split('|');
        discountPct = key === 'discount_5' ? 5 : key === 'discount_10' ? 10 : key === 'discount_20' ? 20 : 0;
        coinsUsed = parseInt(cost);
        discountLabel = label;
        const redeemRes = await BR.data.redeemReward(key, coinsUsed, label);
        if (!redeemRes.ok) { toast('Could not apply discount', 'default', 'fa-triangle-exclamation'); return; }
        await BR.auth.refreshProfile();
      }

      await BR.data.createOrder({
        productId: product.id, productName: product.name, price: product.price,
        coinsUsed, discountPct, deliveryAddress: address,
      });

      const finalPrice = Math.round(product.price * (1 - discountPct / 100));
      const text = `🛍️ **BLOOD REIGN ORDER**\nProduct: ${product.name}\nPrice: ${formatPKR(product.price)}${discountPct ? `\nDiscount: ${discountLabel} (${discountPct}% off)\nFinal: ${formatPKR(finalPrice)}` : ''}\nDelivery: ${address}`;
      const sent = await sendDiscordWebhook(text);
      BR.ui.closeModal('orderModal');
      toast(sent.ok ? "Order sent! We'll confirm on Discord" : 'Order saved! (Discord notify failed — we still got it)', sent.ok ? 'success' : 'default');
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
