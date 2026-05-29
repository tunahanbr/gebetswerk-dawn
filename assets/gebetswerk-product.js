/* Gebetswerk — Product page v2
   Uses Shopify Cart API: /cart/add.js
   Beads = separate Shopify line items → real inventory deducted per product
*/
(function () {
  'use strict';

  /* ── Data from Liquid ─────────────────────────────────────── */
  const VARIANTS = window.GW_VARIANTS   || [];
  const BEADS    = window.GW_BEADS      || [];
  const PRICES   = window.GW_PRICES     || { name1: 1000, name2: 1500, giftwrap: 199 };

  /* ── State ────────────────────────────────────────────────── */
  const state = {
    variantId:   VARIANTS[0]?.id || null,
    variantPrice: VARIANTS[0]?.price || 0,
    qty:         1,
    personalize: true,
    twoNames:    false,
    name1:       '',
    name2:       '',
    thread:      'gold',
    threadHex:   '#c9a24a',
    threadLabel: 'Gold',
    symbol:      'none',
    symbolPos:   'above',
    beadIndex:   0,      // 0 = none
    beadVariantId: null,
    beadPrice:   0,
    beadLabel:   'Keine',
    giftWrap:    false,
    loading:     false,
  };

  /* ── Helpers ──────────────────────────────────────────────── */
  const $ = id => document.getElementById(id);
  const fmt = cents => '€' + (cents / 100).toFixed(2).replace('.', ',');

  function totalCents() {
    let t = state.variantPrice;
    if (state.personalize) {
      t += PRICES.name1;
      if (state.twoNames) t += PRICES.name2;
    }
    t += state.beadPrice;
    if (state.giftWrap) t += PRICES.giftwrap;
    return t * state.qty;
  }

  /* ── Cart API ─────────────────────────────────────────────── */
  async function addToCart() {
    if (state.loading || !state.variantId) return;
    state.loading = true;
    setButtonLoading(true);

    /* Build line items array */
    const items = [{
      id:         state.variantId,
      quantity:   state.qty,
      properties: buildProperties(),
    }];

    /* Add bead as separate line item — real inventory deducted from bead product */
    if (state.beadIndex > 0 && state.beadVariantId) {
      items.push({
        id:       state.beadVariantId,
        quantity: state.qty,
        properties: { '_Zugehöriger Teppich': document.title }
      });
    }

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

      /* Fallback: update cart bubble count manually */
      const bubbles = document.querySelectorAll('.cart-count-bubble span, [data-cart-count]');
      bubbles.forEach(b => { b.textContent = cartRes.item_count; });

      /* If Dawn's notification didn't fire, show brief success state */
      const btn = $('gw-atc-btn');
      if (btn) {
        btn.textContent = '✓ Im Warenkorb';
        btn.style.background = '#2d6a4f';
        setTimeout(() => {
          btn.textContent = 'In den Warenkorb · ' + fmt(totalCents());
          btn.style.background = '';
          state.loading = false;
          setButtonLoading(false);
        }, 2000);
        return;
      }

    } catch (e) {
      console.error('Cart error:', e);
      alert('Netzwerkfehler. Bitte erneut versuchen.');
    }

    state.loading = false;
    setButtonLoading(false);
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
    if (state.personalize && state.name1) {
      props['Name 1'] = state.name1;
      if (state.twoNames && state.name2) props['Name 2'] = state.name2;
      props['Schriftfarbe'] = state.threadLabel;
      if (state.symbol !== 'none') {
        const symLabels = { moon:'Halbmond', heart:'Herz', infinity:'Unendlichkeit' };
        props['Symbol'] = symLabels[state.symbol] || state.symbol;
        const posLabels = { above:'Über dem Namen', below:'Unter dem Namen', left:'Links', right:'Rechts' };
        props['Symbolposition'] = posLabels[state.symbolPos];
      }
    }
    if (state.beadIndex > 0) props['Gebetskette'] = state.beadLabel;
    if (state.giftWrap)      props['Geschenkverpackung'] = 'Ja';
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

    const symChars = { none:'', moon:'☾', heart:'♥', infinity:'∞' };
    const ch = symChars[state.symbol] || '';
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
    const threshold = parseInt(urgency.closest('[data-threshold]')?.dataset.threshold || 10);
    if (inv > 0 && inv <= 10) {
      urgency.querySelector('span:last-child') && (urgency.querySelector('span:last-child').textContent = 'Nur noch ' + inv + ' Stück verfügbar');
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
    function tick() {
      const now = new Date(), cutoff = new Date(now);
      cutoff.setHours(17, 0, 0, 0);
      if (now >= cutoff) cutoff.setDate(cutoff.getDate() + 1);
      const d = cutoff - now;
      el.textContent = [Math.floor(d/3600000), Math.floor(d%3600000/60000), Math.floor(d%60000/1000)]
        .map(n => String(n).padStart(2,'0')).join(':');
    }
    tick(); setInterval(tick, 1000);
  }

  /* ── Init ─────────────────────────────────────────────────── */
  function init() {

    /* ATC button → Cart API */
    const atcBtn = $('gw-atc-btn');
    if (atcBtn) atcBtn.addEventListener('click', addToCart);

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
        updatePreview();
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

    /* Beads — from GW_BEADS array (populated by Liquid blocks) */
    document.querySelectorAll('[data-bead]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.bead);
        const beadData = BEADS[idx];
        state.beadIndex    = idx;
        state.beadVariantId = parseInt(btn.dataset.beadVariant) || null;
        state.beadPrice    = parseInt(btn.dataset.beadPrice) || 0;
        state.beadLabel    = btn.dataset.beadLabel || 'Keine';
        document.querySelectorAll('[data-bead]').forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        updatePrice();
      });
    });

    /* Gift wrap */
    $('gw-giftwrap-toggle')?.addEventListener('change', e => {
      state.giftWrap = e.target.checked; updatePrice();
    });

    /* Color variants */
    document.querySelectorAll('[data-variant-id]').forEach(btn => {
      btn.addEventListener('click', () => selectVariant(btn));
      /* Show color name on hover */
      btn.addEventListener('mouseenter', () => {
        const label = $('gw-color-label');
        if (label) label.textContent = btn.dataset.colorName;
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

    /* Order summary — updates whenever state changes */
    function updateOrderSummary() {
      const summary = $('gw-order-summary');
      const list    = $('gw-order-summary-list');
      if (!summary || !list) return;

      const lines = [];
      const colorLabel = document.querySelector('[data-variant-id].is-active')?.dataset.colorName || '';
      if (colorLabel) lines.push('Farbe: ' + colorLabel);
      if (state.personalize && state.name1) {
        lines.push('Name: ' + state.name1 + (state.twoNames && state.name2 ? ' & ' + state.name2 : ''));
        lines.push('Schrift: ' + state.threadLabel);
        if (state.symbol !== 'none') {
          const symLabels = { moon:'Halbmond ☾', heart:'Herz ♥', infinity:'Unendlichkeit ∞' };
          lines.push('Symbol: ' + (symLabels[state.symbol] || state.symbol));
        }
      }
      if (state.beadIndex > 0) lines.push('Gebetskette: ' + state.beadLabel);
      if (state.giftWrap) lines.push('Geschenkschleife inklusive');

      summary.hidden = lines.length === 0;
      list.innerHTML = lines.map(l => '<li>' + l + '</li>').join('');
    }

    /* Patch all state-changing functions to also update summary */
    const origUpdatePrice = updatePrice;
    function patchedUpdatePrice() { origUpdatePrice(); updateOrderSummary(); }

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
      const firstBtn = document.querySelector('[data-variant-id]');
      if (firstBtn) selectVariant(firstBtn);
      else { state.variantPrice = VARIANTS[0].price; }
    }
    updatePrice();
    updateOrderSummary();
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
})();
