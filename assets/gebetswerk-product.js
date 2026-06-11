/* Gebetswerk — Product page v2
   Uses Shopify Cart API: /cart/add.js
   Beads = separate Shopify line items → real inventory deducted per product
*/
(function () {
  'use strict';

  /* ── Data from Liquid ─────────────────────────────────────── */
  const VARIANTS       = window.GW_VARIANTS       || [];
  const PRICES         = window.GW_PRICES         || { name1: 1000, name2: 1500, giftwrap: 199 };
  const ADDON_VARIANTS = window.GW_ADDON_VARIANTS || { name1: 0, name2: 0, giftwrap: 0 };
  const SYMBOLS        = window.GW_SYMBOLS        || [
    { id: 'none', label: 'Keins', icon: '—' },
    { id: 'moon', label: 'Halbmond', icon: '☾' },
    { id: 'heart', label: 'Herz', icon: '♥' },
    { id: 'infinity', label: 'Unendlich', icon: '∞' },
  ];
  const SYM_ICONS  = Object.fromEntries(SYMBOLS.map(s => [s.id, s.icon]));
  const SYM_LABELS = Object.fromEntries(SYMBOLS.map(s => [s.id, s.label]));

  /* ── State ────────────────────────────────────────────────── */
  const state = {
    variantId:    VARIANTS[0]?.id || null,
    variantPrice: VARIANTS[0]?.price || 0,
    qty:          1,
    personalize:  true,
    twoNames:     false,
    name1:        '',
    name2:        '',
    thread:       'gold',
    threadHex:    '#c9a24a',
    threadLabel:  'Gold',
    symbol:       'none',
    symbolPos:    'above',
    loading:      false,
  };

  /* ── Dynamic Addon State ──────────────────────────────────── */
  // Key → { fieldKey, value, surchargeCents, variantId, separateLineItem }
  const addonMap = new Map();

  function addonTotalCents() {
    let t = 0;
    addonMap.forEach(a => { t += a.surchargeCents || 0; });
    return t;
  }

  function addonCartProperties() {
    const props = {};
    addonMap.forEach(a => { if (a.fieldKey && a.value) props[a.fieldKey] = a.value; });
    return props;
  }

  function addonCartItems() {
    const items = [];
    addonMap.forEach(a => {
      if (a.variantId && a.value) {
        items.push({ id: a.variantId, quantity: state.qty, properties: { '_TeppichVariant': String(state.variantId) } });
      }
    });
    return items;
  }

  /* ── Helpers ──────────────────────────────────────────────── */
  const $ = id => document.getElementById(id);
  const fmt = cents => '€' + (cents / 100).toFixed(2).replace('.', ',');

  function totalCents() {
    let t = state.variantPrice;
    if (state.personalize) {
      t += PRICES.name1;
      if (state.twoNames) t += PRICES.name2;
      if (state.symbol !== 'none') t += PRICES.symbol || 0;
    }
    t += addonTotalCents();
    return t * state.qty;
  }

  /* ── Validation ───────────────────────────────────────────── */
  function showFieldError(inputId, msg) {
    const input = $(inputId);
    if (!input) { alert(msg); return; }
    input.style.borderColor = '#c0392b';
    let err = input.parentElement.querySelector('.gw-form-error');
    if (!err) {
      err = document.createElement('p');
      err.className = 'gw-form-error';
      err.style.cssText = 'color:#c0392b;font-size:12px;margin:6px 0 0;font-family:Inter,system-ui,sans-serif;';
      input.parentElement.appendChild(err);
    }
    err.textContent = msg;
    input.addEventListener('input', () => { input.style.borderColor = ''; err.remove(); }, { once: true });
    input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    input.focus({ preventScroll: true });
  }

  function validatePersonalization() {
    if (!state.personalize) return true;
    if (!state.name1.trim()) {
      showFieldError('gw-name1-input', 'Bitte gib einen Namen ein — oder deaktiviere die Personalisierung.');
      return false;
    }
    if (state.twoNames && !state.name2.trim()) {
      showFieldError('gw-name2-input', 'Bitte gib den zweiten Namen ein — oder deaktiviere die Option.');
      return false;
    }
    return true;
  }

  /* ── Cart API ─────────────────────────────────────────────── */
  async function addToCart() {
    if (state.loading || !state.variantId) return;
    if (!validatePersonalization()) return;
    state.loading = true;
    setButtonLoading(true);

    const props = Object.assign(buildProperties(), addonCartProperties());

    /* Build line items array */
    const items = [{ id: state.variantId, quantity: state.qty, properties: props }];

    /* Personalisierungs-Aufpreise als separate Artikel (korrekter Warenkorb-Preis) */
    if (state.personalize && ADDON_VARIANTS.name1) {
      items.push({ id: ADDON_VARIANTS.name1, quantity: state.qty,
        properties: { '_TeppichVariant': '' + state.variantId, '_Name': state.name1.trim() } });
      if (state.twoNames && ADDON_VARIANTS.name2)
        items.push({ id: ADDON_VARIANTS.name2, quantity: state.qty,
          properties: { '_TeppichVariant': '' + state.variantId, '_Name': state.name2.trim() } });
    }
    if (state.personalize && state.symbol !== 'none' && ADDON_VARIANTS.symbol)
      items.push({ id: ADDON_VARIANTS.symbol, quantity: state.qty,
        properties: { '_TeppichVariant': '' + state.variantId } });

    /* Dynamische Addon-Artikel (opt_product, opt_checkbox mit Variant-ID) */
    addonCartItems().forEach(i => items.push(i));

    try {
      const res = await fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ items }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.description || 'Fehler beim Hinzufügen. Bitte erneut versuchen.');
        return;
      }

      /* Trigger Dawn's cart drawer / notification */
      const cartRes = await fetch('/cart.js').then(r => r.json());
      document.dispatchEvent(new CustomEvent('cart:open',   { bubbles: true }));
      document.dispatchEvent(new CustomEvent('cart:refresh', { bubbles: true }));

      /* Fallback: update cart bubble count — only real rug items, no add-ons */
      const realCount = cartRes.items
        .filter(i => i.product_title !== 'Aufpreise' && !(i.properties && '_Zugehöriger Teppich' in i.properties))
        .reduce((sum, i) => sum + i.quantity, 0);
      document.querySelectorAll('.cart-count-bubble span[aria-hidden]').forEach(b => { b.textContent = realCount; });
      document.querySelectorAll('.cart-count-bubble').forEach(b => { b.hidden = realCount === 0; });

      /* Show success state and offer to configure another rug */
      const btn = $('gw-atc-btn');
      const resetBtn = $('gw-reset-btn');
      if (btn) {
        btn.textContent = '✓ Im Warenkorb';
        btn.style.background = '#2d6a4f';
        if (resetBtn) resetBtn.hidden = false;
        setTimeout(() => {
          btn.textContent = 'In den Warenkorb · ' + fmt(totalCents());
          btn.style.background = '';
          state.loading = false;
          setButtonLoading(false);
        }, 2500);
        return;
      }

    } catch (e) {
      console.error('Cart error:', e);
      alert('Netzwerkfehler. Bitte erneut versuchen.');
    } finally {
      state.loading = false;
      setButtonLoading(false);
    }
  }

  /* ── Jetzt kaufen → Cart API + /checkout ─────────────────────── */
  async function buyNow() {
    if (state.loading || !state.variantId) return;
    if (!validatePersonalization()) return;
    state.loading = true;
    const btn = $('gw-buy-now-btn');
    if (btn) { btn.disabled = true; btn.querySelector('svg')?.remove(); btn.textContent = 'Wird vorbereitet…'; }

    const props = Object.assign(buildProperties(), addonCartProperties());
    const items = [{ id: state.variantId, quantity: state.qty, properties: props }];

    if (state.personalize && ADDON_VARIANTS.name1) {
      items.push({ id: ADDON_VARIANTS.name1, quantity: state.qty,
        properties: { '_TeppichVariant': '' + state.variantId, '_Name': state.name1.trim() } });
      if (state.twoNames && ADDON_VARIANTS.name2)
        items.push({ id: ADDON_VARIANTS.name2, quantity: state.qty,
          properties: { '_TeppichVariant': '' + state.variantId, '_Name': state.name2.trim() } });
    }
    if (state.personalize && state.symbol !== 'none' && ADDON_VARIANTS.symbol)
      items.push({ id: ADDON_VARIANTS.symbol, quantity: state.qty,
        properties: { '_TeppichVariant': '' + state.variantId } });
    addonCartItems().forEach(i => items.push(i));

    try {
      const res = await fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ items }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.description || 'Fehler beim Hinzufügen. Bitte erneut versuchen.');
        return;
      }
      window.location.href = '/checkout';
    } catch (e) {
      console.error('Buy Now error:', e);
      alert('Netzwerkfehler. Bitte erneut versuchen.');
    } finally {
      state.loading = false;
      if (btn) { btn.disabled = false; btn.textContent = 'Jetzt kaufen'; }
    }
  }

  function setButtonLoading(loading) {
    const btns = [$('gw-atc-btn'), $('gw-sticky-atc-btn')];
    btns.forEach(btn => {
      if (!btn) return;
      btn.disabled = loading;
      if (loading) btn.textContent = 'Wird hinzugefügt…';
    });
  }

  /* ── Build line item properties ─────────────────────────────
     These appear in every Shopify order:
     Admin → Orders → [Order] → Line Items → Notes
  ─────────────────────────────────────────────────────────── */
  function buildProperties() {
    const props = {};
    if (state.personalize && state.name1.trim()) {
      props['Name 1'] = state.name1.trim();
      if (state.twoNames && state.name2.trim()) props['Name 2'] = state.name2.trim();
      props['Schriftfarbe'] = state.threadLabel;
      if (state.symbol !== 'none') {
        props['Symbol'] = SYM_LABELS[state.symbol] || state.symbol;
        const posLabels = { above:'Über dem Namen', below:'Unter dem Namen', left:'Links', right:'Rechts', between:'Zwischen den Namen' };
        props['Symbolposition'] = posLabels[state.symbolPos] || state.symbolPos;
      }
    }
    /* Gebetskette & Geschenkverpackung kommen aus addonCartProperties() */
    return props;
  }

  /* ── Price display ────────────────────────────────────────── */
  function updatePrice() {
    const total = totalCents();
    const priceEl = $('gw-price');
    if (priceEl) priceEl.textContent = fmt(total);

    const stickyPrice = $('gw-sticky-price');
    if (stickyPrice) stickyPrice.textContent = fmt(total);

    const atcBtn = $('gw-atc-btn');
    if (atcBtn && !state.loading) atcBtn.textContent = 'In den Warenkorb · ' + fmt(total);

    /* Price breakdown */
    const breakdown = $('gw-price-breakdown');
    if (breakdown) {
      const parts = [fmt(state.variantPrice)];
      if (state.personalize) {
        parts.push('Personalisierung +' + fmt(PRICES.name1));
        if (state.twoNames) parts.push('2. Name +' + fmt(PRICES.name2));
      }
      if (state.beadPrice) parts.push(state.beadLabel + ' +' + fmt(state.beadPrice));
      if (state.giftWrap)  parts.push('Schleife +' + fmt(PRICES.giftwrap));
      if (state.qty > 1)   parts.push('× ' + state.qty);
      breakdown.textContent = parts.join(' · ');
    }

    updateOrderSummary();
  }

  /* ── Live preview overlay ─────────────────────────────────── */
  function updatePreview() {
    const overlay = $('gw-preview-overlay');
    if (!overlay) return;
    const hasName = state.personalize && state.name1.trim().length > 0;
    overlay.hidden = !hasName;
    if (!hasName) return;

    const c = state.threadHex;
    const n1 = $('gw-preview-name1');
    const n2 = $('gw-preview-name2');
    if (n1) { n1.textContent = state.name1; n1.style.color = c; }
    if (n2) {
      const show = state.twoNames && state.name2;
      n2.textContent = show ? '& ' + state.name2 : '';
      n2.style.color = c;
      n2.hidden = !show;
    }

    const ch = SYM_ICONS[state.symbol] || '';
    ['above','below','left','right'].forEach(pos => {
      const el = $('gw-sym-' + pos);
      if (!el) return;
      el.hidden = !(ch && state.symbolPos === pos);
      el.textContent = ch;
      el.style.color = c;
    });
  }

  /* ── Gallery ──────────────────────────────────────────────── */
  function setMainImage(src) {
    const img = $('gw-gallery-main-img');
    if (img && src) img.src = src;
  }

  function setActiveThumb(idx) {
    document.querySelectorAll('.gw-gallery__thumb').forEach((t, i) => t.classList.toggle('is-active', i === idx));
  }

  /* ── Variant switching ────────────────────────────────────── */
  function selectVariant(btn) {
    const id    = parseInt(btn.dataset.variantId);
    const price = parseInt(btn.dataset.variantPrice);
    const name  = btn.dataset.colorName;
    const img   = btn.dataset.variantImg;
    const inv   = parseInt(btn.dataset.variantInventory) || 0;

    state.variantId    = id;
    state.variantPrice = price;

    /* Update form input */
    const input = $('gw-variant-id');
    if (input) input.value = id;

    /* Update color name label */
    const label = $('gw-color-label');
    if (label) label.textContent = name;

    /* Update gallery */
    if (img) { setMainImage(img); setActiveThumb(0); }

    /* Update active swatch */
    document.querySelectorAll('[data-variant-id]').forEach(b => b.classList.toggle('is-active', parseInt(b.dataset.variantId) === id));

    /* Update urgency indicator */
    updateUrgencyFromVariant(btn);

    updatePrice();
  }

  function updateUrgencyFromVariant(btn) {
    const inv = parseInt(btn.dataset.variantInventory) || 0;
    const urgency = $('gw-urgency');
    if (!urgency) return;
    if (inv > 0 && inv <= 10) {
      const textEl = document.getElementById('gw-urgency-text');
      if (textEl) textEl.textContent = 'Nur noch ' + inv + ' Stück verfügbar';
      urgency.hidden = false;
    } else {
      urgency.hidden = inv > 10;
    }
  }

  /* ── Sticky CTA ───────────────────────────────────────────── */
  function initStickyAtc() {
    const stickyBar = $('gw-sticky-atc');
    const atcSection = document.querySelector('.gw-product__actions');
    if (!stickyBar || !atcSection) return;

    const observer = new IntersectionObserver(entries => {
      stickyBar.hidden = entries[0].isIntersecting;
    }, { threshold: 0.1 });
    observer.observe(atcSection);

    const stickyBtn = $('gw-sticky-atc-btn');
    if (stickyBtn) stickyBtn.addEventListener('click', addToCart);
  }

  /* ── Countdown ────────────────────────────────────────────── */
  function startCountdown() {
    const el = $('gw-countdown-time');
    if (!el) return;
    const cutoffHour = window.GW_COUNTDOWN_HOUR || 17;
    function tick() {
      const now = new Date(), cutoff = new Date(now);
      cutoff.setHours(cutoffHour, 0, 0, 0);
      if (now >= cutoff) cutoff.setDate(cutoff.getDate() + 1);
      const d = cutoff - now;
      el.textContent = [Math.floor(d/3600000), Math.floor(d%3600000/60000), Math.floor(d%60000/1000)]
        .map(n => String(n).padStart(2,'0')).join(':');
    }
    tick(); setInterval(tick, 1000);
  }

  /* ── Order summary ────────────────────────────────────────── */
  function updateOrderSummary() {
    const summary = $('gw-order-summary');
    const list    = $('gw-order-summary-list');
    if (!summary || !list) return;

    const lines = [];
    const colorLabel = document.querySelector('[data-variant-id].is-active')?.dataset.colorName || '';
    if (colorLabel) lines.push('Farbe: ' + colorLabel);
    if (state.personalize && state.name1) {
      lines.push('Name 1: ' + state.name1);
      if (state.twoNames && state.name2) lines.push('Name 2: ' + state.name2);
      lines.push('Schrift: ' + state.threadLabel);
      if (state.symbol !== 'none') {
        lines.push('Symbol: ' + (SYM_LABELS[state.symbol] || state.symbol) + ' ' + (SYM_ICONS[state.symbol] || ''));
        const posLabels = { above:'Über dem Namen', below:'Unter dem Namen', left:'Links', right:'Rechts', between:'Zwischen den Namen' };
        lines.push('Position: ' + (posLabels[state.symbolPos] || state.symbolPos));
      }
    }
    addonMap.forEach(a => { if (a.fieldKey && a.value) lines.push(a.fieldKey + ': ' + a.value); });

    summary.hidden = lines.length === 0;
    list.innerHTML = lines.map(l => '<li>' + l + '</li>').join('');
  }

  /* ── Init ─────────────────────────────────────────────────── */
  /* ── Dynamic Addon Initialization ────────────────────────── */
  function initAddons() {
    /* opt_text */
    document.querySelectorAll('[data-addon="text"]').forEach(input => {
      const key = 'text-' + input.dataset.block;
      const base = parseInt(input.dataset.surcharge) || 0;
      addonMap.set(key, { fieldKey: input.dataset.fkey, value: '', surchargeCents: 0, variantId: 0, separateLineItem: false });
      input.addEventListener('input', () => {
        if (input.maxLength > 0) input.value = input.value.slice(0, input.maxLength);
        const a = addonMap.get(key);
        a.value = input.value;
        a.surchargeCents = input.value.length > 0 ? base : 0;
        const counter = document.querySelector('[data-counter="' + input.dataset.block + '"]');
        if (counter) counter.textContent = input.value.length + '/' + (input.maxLength > 0 ? input.maxLength : '∞');
        updatePrice();
      });
    });

    /* opt_checkbox */
    document.querySelectorAll('[data-addon="checkbox"]').forEach(cb => {
      const key = 'cb-' + cb.dataset.block;
      const surcharge = parseInt(cb.dataset.surcharge) || 0;
      const vid = parseInt(cb.dataset.variant) || 0;
      addonMap.set(key, { fieldKey: cb.dataset.fkey, value: cb.checked ? 'Ja' : '', surchargeCents: cb.checked ? surcharge : 0, variantId: vid, separateLineItem: vid > 0 });
      cb.addEventListener('change', () => {
        const a = addonMap.get(key);
        a.value = cb.checked ? 'Ja' : '';
        a.surchargeCents = cb.checked ? surcharge : 0;
        updatePrice();
      });
    });

    /* opt_choice → dropdown */
    document.querySelectorAll('[data-addon="choice-select"]').forEach(sel => {
      const gid = sel.dataset.gid;
      const key = 'choice-' + gid;
      const fkey = sel.closest('[data-addon="choice-group"]')?.dataset.fkey || gid;
      const update = () => {
        const opt = sel.options[sel.selectedIndex];
        addonMap.set(key, { fieldKey: fkey, value: opt?.value || '', surchargeCents: parseInt(opt?.dataset.surcharge) || 0, variantId: parseInt(opt?.dataset.variant) || 0, separateLineItem: false });
        updatePrice();
      };
      update(); sel.addEventListener('change', update);
    });

    /* opt_choice → buttons / swatches / images */
    document.querySelectorAll('[data-addon="choice-btn"]').forEach(btn => {
      const gid = btn.dataset.gid;
      const key = 'choice-' + gid;
      const fkey = btn.closest('[data-addon="choice-group"]')?.dataset.fkey || gid;
      if (btn.classList.contains('is-active')) {
        addonMap.set(key, { fieldKey: fkey, value: btn.dataset.val || '', surchargeCents: parseInt(btn.dataset.surcharge) || 0, variantId: parseInt(btn.dataset.variant) || 0, separateLineItem: false });
      }
      btn.addEventListener('click', () => {
        btn.closest('[data-addon="choice-group"]')?.querySelectorAll('[data-addon="choice-btn"]').forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        addonMap.set(key, { fieldKey: fkey, value: btn.dataset.val || '', surchargeCents: parseInt(btn.dataset.surcharge) || 0, variantId: parseInt(btn.dataset.variant) || 0, separateLineItem: false });
        updatePrice();
      });
    });

    /* opt_product → image_grid cards */
    document.querySelectorAll('[data-addon="product-card"]').forEach(btn => {
      const blockId = btn.dataset.block;
      const key = 'prod-' + blockId;
      const sep = btn.dataset.separate === 'true';
      if (btn.classList.contains('is-active')) {
        addonMap.set(key, { fieldKey: btn.dataset.fkey, value: btn.dataset.val || '', surchargeCents: parseInt(btn.dataset.price) || 0, variantId: parseInt(btn.dataset.variant) || 0, separateLineItem: sep });
      }
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-addon="product-card"][data-block="' + blockId + '"]').forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        addonMap.set(key, { fieldKey: btn.dataset.fkey, value: btn.dataset.val || '', surchargeCents: parseInt(btn.dataset.price) || 0, variantId: parseInt(btn.dataset.variant) || 0, separateLineItem: sep });
        updatePrice();
      });
    });

    /* opt_product → dropdown */
    document.querySelectorAll('[data-addon="product-select"]').forEach(sel => {
      const key = 'prod-' + sel.dataset.block;
      const sep = sel.dataset.separate === 'true';
      const update = () => {
        const opt = sel.options[sel.selectedIndex];
        addonMap.set(key, { fieldKey: sel.dataset.fkey, value: opt?.value || '', surchargeCents: parseInt(opt?.dataset.price) || 0, variantId: parseInt(opt?.dataset.variant) || 0, separateLineItem: sep });
        updatePrice();
      };
      update(); sel.addEventListener('change', update);
    });

    /* opt_product → radio list */
    document.querySelectorAll('[data-addon="product-radio"]').forEach(radio => {
      const key = 'prod-' + radio.dataset.block;
      const sep = radio.dataset.separate === 'true';
      if (radio.checked) addonMap.set(key, { fieldKey: radio.dataset.fkey, value: radio.value || '', surchargeCents: parseInt(radio.dataset.price) || 0, variantId: parseInt(radio.dataset.variant) || 0, separateLineItem: sep });
      radio.addEventListener('change', () => {
        addonMap.set(key, { fieldKey: radio.dataset.fkey, value: radio.value || '', surchargeCents: parseInt(radio.dataset.price) || 0, variantId: parseInt(radio.dataset.variant) || 0, separateLineItem: sep });
        updatePrice();
      });
    });
  }

  function init() {

    /* ATC button → Cart API */
    const atcBtn = $('gw-atc-btn');
    if (atcBtn) atcBtn.addEventListener('click', addToCart);

    /* Buy Now → Cart API + /checkout */
    const buyNowBtn = $('gw-buy-now-btn');
    if (buyNowBtn) buyNowBtn.addEventListener('click', buyNow);

    /* Reset-Button → Formular zurücksetzen für zweiten Teppich */
    const resetBtn = $('gw-reset-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        /* Namen leeren */
        const n1 = $('gw-name1-input'); if (n1) { n1.value = ''; state.name1 = ''; }
        const n2 = $('gw-name2-input'); if (n2) { n2.value = ''; state.name2 = ''; }
        const c1 = $('gw-name1-count'); if (c1) c1.textContent = '0/11';
        const c2 = $('gw-name2-count'); if (c2) c2.textContent = '0/11';

        /* Zweiten Namen ausblenden */
        state.twoNames = false;
        const twoTog = $('gw-twonames-toggle'); if (twoTog) twoTog.checked = false;
        const n2sec  = $('gw-name2-section');  if (n2sec)  n2sec.hidden = true;

        /* Symbol zurücksetzen */
        state.symbol = 'none';
        document.querySelectorAll('[data-symbol]').forEach((b, i) => b.classList.toggle('is-active', i === 0));
        const posSection = $('gw-sympos-section'); if (posSection) posSection.hidden = true;
        const priceTag   = $('gw-symbol-price-tag'); if (priceTag) priceTag.hidden = true;

        /* Geschenk zurücksetzen */
        state.giftWrap = false;
        const gwTog = $('gw-giftwrap-toggle'); if (gwTog) gwTog.checked = false;

        /* Qty auf 1 */
        state.qty = 1;
        const qtyVal = $('gw-qty-val'); if (qtyVal) qtyVal.textContent = '1';
        const qtyInp = $('gw-qty-input'); if (qtyInp) qtyInp.value = '1';

        /* Addon-State zurücksetzen */
        addonMap.forEach((a, key) => {
          a.value = ''; a.surchargeCents = 0;
          if (key.startsWith('text-')) {
            const input = document.querySelector('[data-addon="text"][data-block="' + key.slice(5) + '"]');
            if (input) { input.value = ''; const c = document.querySelector('[data-counter="' + key.slice(5) + '"]'); if (c) c.textContent = '0/' + input.maxLength; }
          } else if (key.startsWith('cb-')) {
            const cb = document.querySelector('[data-addon="checkbox"][data-block="' + key.slice(3) + '"]');
            if (cb) cb.checked = false;
          }
        });

        /* Reset-Button wieder ausblenden */
        resetBtn.hidden = true;

        updatePrice();
        updatePreview();

        /* Zum Formular scrollen */
        document.querySelector('.gw-personalize-box')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }

    /* Quantity */
    $('gw-qty-minus')?.addEventListener('click', () => { state.qty = Math.max(1, state.qty - 1); $('gw-qty-val').textContent = state.qty; $('gw-qty-input').value = state.qty; updatePrice(); });
    $('gw-qty-plus') ?.addEventListener('click', () => { state.qty++; $('gw-qty-val').textContent = state.qty; $('gw-qty-input').value = state.qty; updatePrice(); });

    /* Personalization toggle */
    const persTog = $('gw-personalize-toggle');
    const persFields = $('gw-personalize-fields');
    if (persTog) {
      persTog.checked = state.personalize;
      persTog.addEventListener('change', e => {
        state.personalize = e.target.checked;
        if (persFields) persFields.hidden = !state.personalize;
        updatePrice(); updatePreview();
      });
    }
    if (persFields) persFields.hidden = !state.personalize;

    /* Name 1 */
    $('gw-name1-input')?.addEventListener('input', e => {
      state.name1 = e.target.value = e.target.value.slice(0, 11);
      const c = $('gw-name1-count'); if (c) c.textContent = state.name1.length + '/11';
      updatePreview();
    });

    /* Two names toggle */
    const twoTog = $('gw-twonames-toggle');
    const name2Sec = $('gw-name2-section');
    twoTog?.addEventListener('change', e => {
      state.twoNames = e.target.checked;
      if (name2Sec) name2Sec.hidden = !state.twoNames;
      const betweenBtn = $('gw-sympos-between');
      if (betweenBtn) betweenBtn.hidden = !state.twoNames;
      if (!state.twoNames && state.symbolPos === 'between') {
        state.symbolPos = 'left';
        document.querySelectorAll('[data-sympos]').forEach(b => b.classList.remove('is-active'));
        const leftBtn = document.querySelector('[data-sympos="left"]');
        if (leftBtn) leftBtn.classList.add('is-active');
      }
      updatePrice(); updatePreview();
    });
    if (name2Sec) name2Sec.hidden = true;

    /* Name 2 */
    $('gw-name2-input')?.addEventListener('input', e => {
      state.name2 = e.target.value = e.target.value.slice(0, 11);
      const c = $('gw-name2-count'); if (c) c.textContent = state.name2.length + '/11';
      updatePreview();
    });

    /* Thread colors */
    document.querySelectorAll('[data-thread]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.thread      = btn.dataset.thread;
        state.threadHex   = btn.dataset.hex;
        state.threadLabel = btn.dataset.label || btn.dataset.thread;
        document.querySelectorAll('[data-thread]').forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        updateSymbols(); updatePreview();
      });
    });

    /* Symbols */
    document.querySelectorAll('[data-symbol]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.symbol = btn.dataset.symbol;
        document.querySelectorAll('[data-symbol]').forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        const posSection = $('gw-sympos-section');
        if (posSection) posSection.hidden = state.symbol === 'none';
        const priceTag = $('gw-symbol-price-tag');
        if (priceTag) priceTag.hidden = state.symbol === 'none';
        if (state.symbol === 'none' && state.symbolPos === 'between') {
          state.symbolPos = 'left';
        }
        updatePrice(); updatePreview();
      });
    });

    /* Symbol position */
    document.querySelectorAll('[data-sympos]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.symbolPos = btn.dataset.sympos;
        document.querySelectorAll('[data-sympos]').forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        updatePreview();
      });
    });

    /* Dynamische Addons (opt_text, opt_checkbox, opt_choice, opt_product) */
    initAddons();

    /* Color variants */
    document.querySelectorAll('[data-variant-id]').forEach(btn => {
      btn.addEventListener('click', () => selectVariant(btn));
      btn.addEventListener('mouseenter', () => {
        const label = $('gw-color-label');
        if (label) label.textContent = btn.dataset.colorName;
      });
      btn.addEventListener('mouseleave', () => {
        const label = $('gw-color-label');
        const active = document.querySelector('[data-variant-id].is-active');
        if (label && active) label.textContent = active.dataset.colorName;
      });
    });

    /* Gallery thumbs */
    document.querySelectorAll('.gw-gallery__thumb').forEach((thumb, i) => {
      thumb.addEventListener('click', () => { setMainImage(thumb.dataset.src); setActiveThumb(i); });
    });

      /* Gift message toggle */
    const giftMsgToggle  = $('gw-giftmsg-toggle');
    const giftMsgSection = $('gw-giftmsg-section');
    const giftMsgInput   = $('gw-giftmsg-input');
    giftMsgToggle?.addEventListener('change', e => {
      if (giftMsgSection) giftMsgSection.hidden = !e.target.checked;
    });
    giftMsgInput?.addEventListener('input', () => {
      const c = $('gw-giftmsg-count');
      if (c) c.textContent = giftMsgInput.value.length + '/200';
    });

    /* Social proof live counter (subtle fluctuation) */
    const viewersEl = $('gw-viewers');
    if (viewersEl) {
      const base = parseInt(viewersEl.textContent) || 12;
      setInterval(() => {
        const delta = Math.floor(Math.random() * 3) - 1; // -1, 0, or +1
        const current = parseInt(viewersEl.textContent) || base;
        const next = Math.max(base - 3, Math.min(base + 6, current + delta));
        if (next !== current) viewersEl.textContent = next;
      }, 8000);
    }

    /* Init */
    if (VARIANTS[0]) {
      const urlVariantId = new URLSearchParams(window.location.search).get('variant');
      let initBtn = urlVariantId
        ? document.querySelector('[data-variant-id="' + urlVariantId + '"]')
        : null;
      if (!initBtn) initBtn = document.querySelector('[data-variant-id]');
      if (initBtn) selectVariant(initBtn);
      else { state.variantPrice = VARIANTS[0].price; }
    }
    updatePrice();
    updateSymbols();
    updatePreview();
    initStickyAtc();
    startCountdown();
  }

  function updateSymbols() {
    document.querySelectorAll('[data-symbol] .gw-symbol-btn__icon').forEach(el => {
      el.style.color = state.threadHex;
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* Re-init after Shopify Theme Editor / Hot Reload replaces the section HTML */
  document.addEventListener('shopify:section:load', init);
})();
