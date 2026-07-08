/* Gebetswerk — Product page v2
   Uses Shopify Cart API: /cart/add.js
   Beads = separate Shopify line items → real inventory deducted per product
*/
(function () {
  'use strict';

  /* ── Data from Liquid ─────────────────────────────────────── */
  const ROUTES         = window.routes            || {};
  const CART_ADD_URL   = (ROUTES.cart_add_url || '/cart/add') + '.js';
  const CART_JS_URL    = (ROUTES.cart_url || '/cart') + '.js';
  const VARIANTS       = window.GW_VARIANTS       || [];
  const PRICES         = window.GW_PRICES         || { name1: 1000, name2: 1500, symbol: 400 };
  const ADDON_VARIANTS = window.GW_ADDON_VARIANTS || { name1: 0, name2: 0, symbol: 0 };
  const SYMBOLS        = window.GW_SYMBOLS        || [
    { id: 'none', label: 'Keins', icon: '—' },
    { id: 'moon', label: 'Halbmond', icon: '☾' },
    { id: 'heart', label: 'Herz', icon: '♥' },
    { id: 'infinity', label: 'Unendlich', icon: '∞' },
  ];
  const SYM_ICONS  = Object.fromEntries(SYMBOLS.map(s => [s.id, s.icon]));
  const SYM_LABELS = Object.fromEntries(SYMBOLS.map(s => [s.id, s.label]));
  const STRINGS = Object.assign({
    atc:     'In den Warenkorb',
    soldOut: 'Ausverkauft',
    added:   '✓ Im Warenkorb',
    buyNow:  'Jetzt kaufen',
    urgency: 'Nur noch [Anzahl] Stück verfügbar',
  }, window.GW_STRINGS || {});

  const nameMax = el => (el && el.maxLength > 0 ? el.maxLength : 11);

  /* ── State ────────────────────────────────────────────────── */
  const state = {
    variantId:    VARIANTS[0]?.id || null,
    variantPrice: VARIANTS[0]?.price || 0,
    available:    VARIANTS[0] ? VARIANTS[0].available !== false : true,
    qty:          1,
    personalize:  true,
    twoNames:     false,
    name1:        '',
    name2:        '',
    thread:       'gold',
    threadHex:    '#c9a24a',
    threadLabel:  'Gold',
    symbol:       'none',
    symbolPos:    'left',
    loading:      false,
  };

  /* ── Dynamic Addon State ──────────────────────────────────── */
  // Key → { fieldKey, value, surchargeCents, variantId, separateLineItem }
  const addonMap = new Map();

  /* Wird in init() gesetzt — erlaubt addToCart() das Formular zurückzusetzen */
  let doResetForm = function () {};

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
      if (a.separateLineItem && a.variantId && a.value) {
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
    input.classList.add('is-error');
    let err = input.parentElement.querySelector('.gw-form-error');
    if (!err) {
      err = document.createElement('p');
      err.className = 'gw-form-error';
      input.parentElement.appendChild(err);
    }
    err.textContent = msg;
    input.addEventListener('input', () => { input.classList.remove('is-error'); err.remove(); }, { once: true });
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
    for (const input of document.querySelectorAll('[data-addon="text"][data-required="true"]')) {
      if (!input.value.trim()) {
        const label = document.querySelector(`label[for="${input.id}"]`)?.textContent?.replace('*', '').trim() || 'Dieses Feld';
        showFieldError(input.id, label + ' ist ein Pflichtfeld.');
        return false;
      }
    }
    return true;
  }

  /* ── Inline-Fehler statt alert() ──────────────────────────── */
  let cartErrorTimer = null;
  function showCartError(msg) {
    const actions = document.querySelector('.gw-product__actions');
    if (!actions) { alert(msg); return; }
    let err = document.getElementById('gw-cart-error');
    if (!err) {
      err = document.createElement('p');
      err.id = 'gw-cart-error';
      err.className = 'gw-cart-error';
      err.setAttribute('role', 'alert');
      actions.insertAdjacentElement('afterend', err);
    }
    err.textContent = msg;
    clearTimeout(cartErrorTimer);
    cartErrorTimer = setTimeout(() => err.remove(), 6000);
  }

  /* ── Cart Bubble ──────────────────────────────────────────── */
  function updateCartBubble(count) {
    const link = document.getElementById('cart-icon-bubble');
    if (!link) return;
    let bubble = link.querySelector('.cart-count-bubble');
    if (count <= 0) {
      if (bubble) bubble.remove();
      return;
    }
    if (!bubble) {
      bubble = document.createElement('div');
      bubble.className = 'cart-count-bubble';
      link.appendChild(bubble);
    }
    const n = count < 100 ? count : '';
    bubble.innerHTML = `<span aria-hidden="true">${n}</span><span class="visually-hidden">${count} im Warenkorb</span>`;
  }

  function buildCartItems() {
    const ref = 'gw-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    const setLabel = state.personalize && state.name1.trim()
      ? (state.twoNames && state.name2.trim() ? state.name1.trim() + ' & ' + state.name2.trim() : state.name1.trim())
      : '';
    const props = Object.assign(buildProperties(), addonCartProperties(), { '_ref': ref });
    const items = [{ id: state.variantId, quantity: state.qty, properties: props }];

    if (state.personalize && ADDON_VARIANTS.name1) {
      items.push({ id: ADDON_VARIANTS.name1, quantity: state.qty,
        properties: { '_ref': ref, '_TeppichVariant': '' + state.variantId, '_Name': state.name1.trim() } });
      if (state.twoNames && ADDON_VARIANTS.name2) {
        items.push({ id: ADDON_VARIANTS.name2, quantity: state.qty,
          properties: { '_ref': ref, '_TeppichVariant': '' + state.variantId, '_Name': state.name2.trim() } });
      }
    }

    if (state.personalize && state.symbol !== 'none' && ADDON_VARIANTS.symbol) {
      items.push({ id: ADDON_VARIANTS.symbol, quantity: state.qty,
        properties: { '_ref': ref, '_TeppichVariant': '' + state.variantId } });
    }

    addonCartItems().forEach(item => {
      item.properties = Object.assign({}, item.properties, { '_ref': ref });
      items.push(item);
    });

    if (setLabel) {
      items.forEach((item, idx) => {
        if (idx > 0) item.properties = Object.assign({}, item.properties, { '_Für': setLabel });
      });
    }

    return items;
  }

  /* ── Cart API ─────────────────────────────────────────────── */
  function endLoading() {
    state.loading = false;
    setButtonLoading(false);
    resetButtonText();
  }

  async function addToCart(openDrawer) {
    if (state.loading || !state.variantId || !state.available) return false;
    if (!validatePersonalization()) return false;
    state.loading = true;
    setButtonLoading(true);

    const items = buildCartItems();
    /* Funktioniert in beiden Cart-Modi: Drawer ODER Notification-Popup.
       Vorher wurde nur cart-drawer gesucht — im Notification-Modus (Standard
       dieses Themes) gab es deshalb auf Mobil keine Rückmeldung. */
    const cartUI = document.querySelector('cart-drawer') || document.querySelector('cart-notification');
    const wantRender = openDrawer !== false && cartUI && typeof cartUI.getSectionsToRender === 'function';
    const addPayload = { items };
    if (wantRender) {
      addPayload.sections = cartUI.getSectionsToRender().map(section => section.id);
      addPayload.sections_url = window.location.pathname;
    }

    try {
      const res = await fetch(CART_ADD_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(addPayload),
      });

      if (!res.ok) {
        const err = await res.json();
        showCartError(err.description || 'Fehler beim Hinzufügen. Bitte erneut versuchen.');
        endLoading();
        return false;
      }

      const parsedState = await res.json();
      if (wantRender && typeof cartUI.renderContents === 'function' && parsedState.sections) {
        /* Das Notification-Popup braucht den Key der Hauptzeile (Multi-Item-Add
           liefert keinen Top-Level-Key) — sonst bleibt die Produktvorschau leer. */
        if (cartUI.tagName === 'CART-NOTIFICATION' && !parsedState.key) {
          const firstItem = Array.isArray(parsedState.items) ? parsedState.items[0] : null;
          if (firstItem) parsedState.key = firstItem.key;
        }
        cartUI.renderContents(parsedState);

        /* renderContents ersetzt nur das innere HTML von #CartDrawer, lässt aber
           die is-empty-Klasse auf <cart-drawer> stehen. Dadurch bleibt das
           Items-Layout im Leer-Zustand hängen (CSS: cart-drawer.is-empty
           .drawer__inner { display:grid } + .drawer__header { display:none }) und
           der Warenkorb wirkt leer, bis man die Seite neu lädt. Nach dem
           Hinzufügen ist der Warenkorb nie leer → Klasse entfernen. */
        if (cartUI.tagName === 'CART-DRAWER') {
          cartUI.classList.remove('is-empty');
          cartUI.querySelector('cart-drawer-items')?.classList.remove('is-empty');
        }
      }

      /* Trigger Dawn's pubsub listeners where present */
      const cartRes = await fetch(CART_JS_URL).then(r => r.json());
      if (typeof publish === 'function' && typeof PUB_SUB_EVENTS !== 'undefined' && PUB_SUB_EVENTS.cartUpdate) {
        publish(PUB_SUB_EVENTS.cartUpdate, { source: 'gebetswerk-product', cartData: cartRes, variantId: state.variantId });
      }

      /* Update cart bubble — inject element if cart was empty before */
      const realCount = cartRes.items
        .filter(i => !(i.properties && i.properties['_TeppichVariant']))
        .reduce((sum, i) => sum + i.quantity, 0);
      updateCartBubble(realCount);

      /* Personalisierung nach dem Hinzufügen zurücksetzen (Daten sind bereits
         im Warenkorb) — Farbe bleibt erhalten, nur die Personalisierung wird geleert. */
      if (openDrawer !== false) doResetForm();

      /* Erfolg auf BEIDEN Buttons (Haupt + Sticky-Mobil) anzeigen. Buttons bleiben
         währenddessen disabled (verhindert Doppel-Hinzufügen), danach sauber zurücksetzen. */
      const successBtns = [$('gw-atc-btn'), $('gw-sticky-atc-btn')].filter(Boolean);
      successBtns.forEach(b => { b.textContent = STRINGS.added; b.classList.add('is-success'); });
      setTimeout(() => {
        successBtns.forEach(b => b.classList.remove('is-success'));
        endLoading();
      }, 2000);
      return true;

    } catch (e) {
      console.error('Cart error:', e);
      showCartError('Netzwerkfehler. Bitte erneut versuchen.');
      endLoading();
      return false;
    }
  }

  /* ── Jetzt kaufen → Cart API + /checkout ─────────────────────── */
  async function buyNow() {
    if (state.loading || !state.variantId || !state.available) return;
    if (!validatePersonalization()) return;
    state.loading = true;
    const btn = $('gw-buy-now-btn');
    if (btn) { btn.disabled = true; btn.querySelector('svg')?.remove(); btn.textContent = 'Wird vorbereitet…'; }

    try {
      const res = await fetch(CART_ADD_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ items: buildCartItems() }),
      });
      if (!res.ok) {
        const err = await res.json();
        showCartError(err.description || 'Fehler beim Hinzufügen. Bitte erneut versuchen.');
        return;
      }
      window.location.href = '/checkout';
    } catch (e) {
      console.error('Buy Now error:', e);
      showCartError('Netzwerkfehler. Bitte erneut versuchen.');
    } finally {
      state.loading = false;
      if (btn) { btn.disabled = false; btn.textContent = STRINGS.buyNow; }
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

  /* Stellt die normalen Button-Beschriftungen wieder her (nach Erfolg/Abbruch). */
  function resetButtonText() {
    const atc = $('gw-atc-btn');
    if (atc) {
      atc.disabled = !state.available;
      atc.textContent = state.available ? STRINGS.atc + ' · ' + fmt(totalCents()) : STRINGS.soldOut;
    }
    const sticky = $('gw-sticky-atc-btn');
    if (sticky) {
      sticky.disabled = !state.available;
      sticky.textContent = state.available ? STRINGS.atc : STRINGS.soldOut;
    }
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

    if (!state.loading) resetButtonText();

    updateOrderSummary();
  }

  /* ── Gallery (Swipe-Carousel) ─────────────────────────────── */
  /* Aktualisiert das erste Slide-Bild (= gewählte Farbe) und scrollt nach vorn */
  function setVariantImage(src) {
    const img = $('gw-gallery-variant-img');
    if (img && src) {
      if (/[?&]width=\d+/.test(src)) {
        const widths = [400, 600, 800, 1200, 1600];
        img.srcset = widths
          .map(w => src.replace(/([?&])width=\d+/, '$1width=' + w) + ' ' + w + 'w')
          .join(', ');
      } else {
        img.removeAttribute('srcset');
        img.removeAttribute('sizes');
      }
      img.src = src;
    }
    const vp = $('gw-gallery-viewport');
    if (vp) vp.scrollTo({ left: 0, behavior: 'smooth' });
  }

  function initGallery() {
    const viewport = $('gw-gallery-viewport');
    const dotsWrap = $('gw-gallery-dots');
    const prev = $('gw-gallery-prev');
    const next = $('gw-gallery-next');
    if (!viewport) return;
    const slides = Array.from(viewport.children);
    const single = slides.length <= 1;
    if (single) {
      if (dotsWrap) dotsWrap.style.display = 'none';
      [prev, next].forEach(b => { if (b) b.style.display = 'none'; });
    }

    if (dotsWrap && !single) {
      dotsWrap.replaceChildren();
      slides.forEach((_, i) => {
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'gw-gallery__dot' + (i === 0 ? ' is-active' : '');
        dot.setAttribute('aria-label', 'Bild ' + (i + 1));
        dot.addEventListener('click', () => {
          viewport.scrollTo({ left: i * viewport.clientWidth, behavior: 'smooth' });
        });
        dotsWrap.appendChild(dot);
      });
    }

    function updateControls() {
      const idx = Math.round(viewport.scrollLeft / viewport.clientWidth);
      const max = viewport.scrollWidth - viewport.clientWidth - 1;
      dotsWrap?.querySelectorAll('.gw-gallery__dot').forEach((d, i) => d.classList.toggle('is-active', i === idx));
      if (prev) prev.disabled = viewport.scrollLeft <= 1;
      if (next) next.disabled = viewport.scrollLeft >= max;
    }

    prev?.addEventListener('click', () => viewport.scrollBy({ left: -viewport.clientWidth, behavior: 'smooth' }));
    next?.addEventListener('click', () => viewport.scrollBy({ left: viewport.clientWidth, behavior: 'smooth' }));

    /* Punkte + Pfeile beim Wischen/Scrollen mitführen */
    viewport.addEventListener('scroll', updateControls, { passive: true });
    if (!single) updateControls();
  }

  /* ── Variant switching ────────────────────────────────────── */
  function selectVariant(btn) {
    const id    = parseInt(btn.dataset.variantId);
    const price = parseInt(btn.dataset.variantPrice);
    const name  = btn.dataset.colorName;
    const img   = btn.dataset.variantImg;

    state.variantId    = id;
    state.variantPrice = price;
    state.available    = btn.dataset.variantAvailable === 'true';

    /* Update form input */
    const input = $('gw-variant-id');
    if (input) input.value = id;

    /* Update color name label */
    const label = $('gw-color-label');
    if (label) label.textContent = name;

    /* Update gallery — erstes Slide zeigt die gewählte Farbe */
    if (img) { setVariantImage(img); }

    /* Streichpreis der Variante anzeigen/verstecken */
    const compareEl = $('gw-price-original');
    if (compareEl) {
      const cmp = parseInt(btn.dataset.variantCompare) || 0;
      if (cmp > price) {
        compareEl.textContent = fmt(cmp);
        compareEl.hidden = false;
      } else {
        compareEl.hidden = true;
      }
    }

    /* Update active swatch */
    document.querySelectorAll('.gw-color-swatch[data-variant-id]').forEach(b => {
      const active = parseInt(b.dataset.variantId) === id;
      b.classList.toggle('is-active', active);
      b.setAttribute('aria-pressed', active ? 'true' : 'false');
    });

    /* Update urgency indicator */
    updateUrgencyFromVariant(btn);

    updatePrice();
  }

  function updateUrgencyFromVariant(btn) {
    const urgency = $('gw-urgency');
    const textEl  = $('gw-urgency-text');
    if (!urgency || !textEl) return;
    const inv       = parseInt(btn.dataset.variantInventory) || 0;
    const available = btn.dataset.variantAvailable === 'true';
    const threshold = parseInt(urgency.dataset.threshold) || 10;
    if (!available) {
      textEl.textContent = STRINGS.soldOut;
      urgency.hidden = false;
    } else if (inv > 0 && inv <= threshold) {
      textEl.textContent = STRINGS.urgency.replace('[Anzahl]', inv);
      urgency.hidden = false;
    } else {
      urgency.hidden = true;
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

  /* ── Order summary ────────────────────────────────────────── */
  function updateOrderSummary() {
    const summary = $('gw-order-summary');
    const list    = $('gw-order-summary-list');
    if (!summary || !list) return;

    const lines = [];
    const colorLabel = document.querySelector('.gw-color-swatch[data-variant-id].is-active')?.dataset.colorName || '';
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
    list.replaceChildren();
    lines.forEach(line => {
      const li = document.createElement('li');
      li.textContent = line;
      list.appendChild(li);
    });
  }

  /* ── Init ─────────────────────────────────────────────────── */
  /* ── Dynamic Addon Initialization ────────────────────────── */
  function initAddons() {
    /* opt_text */
    document.querySelectorAll('[data-addon="text"]').forEach(input => {
      const key = 'text-' + input.dataset.block;
      const base = parseInt(input.dataset.surcharge) || 0;
      const vid = parseInt(input.dataset.variant) || 0;
      addonMap.set(key, { fieldKey: input.dataset.fkey, value: '', surchargeCents: 0, variantId: vid, separateLineItem: vid > 0 });
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
        addonMap.set(key, { fieldKey: fkey, value: opt?.value || '', surchargeCents: parseInt(opt?.dataset.surcharge) || 0, variantId: parseInt(opt?.dataset.variant) || 0, separateLineItem: parseInt(opt?.dataset.variant) > 0 });
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
        addonMap.set(key, { fieldKey: fkey, value: btn.dataset.val || '', surchargeCents: parseInt(btn.dataset.surcharge) || 0, variantId: parseInt(btn.dataset.variant) || 0, separateLineItem: parseInt(btn.dataset.variant) > 0 });
      }
      btn.addEventListener('click', () => {
        btn.closest('[data-addon="choice-group"]')?.querySelectorAll('[data-addon="choice-btn"]').forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        addonMap.set(key, { fieldKey: fkey, value: btn.dataset.val || '', surchargeCents: parseInt(btn.dataset.surcharge) || 0, variantId: parseInt(btn.dataset.variant) > 0 ? parseInt(btn.dataset.variant) : 0, separateLineItem: parseInt(btn.dataset.variant) > 0 });
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

    /* Info-Tooltips (?) — Tap öffnet/schließt, Tap außerhalb schließt */
    document.addEventListener('click', e => {
      const btn = e.target.closest('.gw-info-tip__btn');
      document.querySelectorAll('.gw-info-tip.is-open').forEach(tip => {
        if (!btn || tip !== btn.parentElement) {
          tip.classList.remove('is-open');
          tip.querySelector('.gw-info-tip__btn')?.setAttribute('aria-expanded', 'false');
        }
      });
      if (btn) {
        e.preventDefault();
        const tip = btn.parentElement;
        const open = tip.classList.toggle('is-open');
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      }
    });

    /* ATC button → Cart API */
    const atcBtn = $('gw-atc-btn');
    if (atcBtn) atcBtn.addEventListener('click', addToCart);

    /* Buy Now → Cart API + /checkout */
    const buyNowBtn = $('gw-buy-now-btn');
    if (buyNowBtn) buyNowBtn.addEventListener('click', buyNow);

    /* Formular für den nächsten Teppich leeren (ohne den Warenkorb anzufassen) */
    function resetForm() {
      /* Namen leeren */
      const n1 = $('gw-name1-input'); if (n1) { n1.value = ''; state.name1 = ''; }
      const n2 = $('gw-name2-input'); if (n2) { n2.value = ''; state.name2 = ''; }
      const c1 = $('gw-name1-count'); if (c1) c1.textContent = '0/' + nameMax(n1);
      const c2 = $('gw-name2-count'); if (c2) c2.textContent = '0/' + nameMax(n2);

      /* Zweiten Namen ausblenden */
      state.twoNames = false;
      const twoTog = $('gw-twonames-toggle'); if (twoTog) twoTog.checked = false;
      const n2sec  = $('gw-name2-section');  if (n2sec)  n2sec.hidden = true;

      /* Symbol zurücksetzen */
      state.symbol = 'none';
      document.querySelectorAll('[data-symbol]').forEach((b, i) => {
        b.classList.toggle('is-active', i === 0);
        b.setAttribute('aria-pressed', i === 0 ? 'true' : 'false');
      });
      const posSection = $('gw-sympos-section'); if (posSection) posSection.hidden = true;
      const priceTag   = $('gw-symbol-price-tag'); if (priceTag) priceTag.hidden = true;

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

      updatePrice();
      updateOrderSummary();
    }
    doResetForm = resetForm;

    /* „Weiteren Teppich personalisieren" → aktuellen Teppich in den Warenkorb,
       dann Formular leeren und hoch zum Namensfeld scrollen (Drawer bleibt zu) */
    const resetBtn = $('gw-reset-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', async () => {
        const ok = await addToCart(false);
        if (!ok) return;
        resetForm();
        const n1 = $('gw-name1-input');
        if (n1) {
          n1.scrollIntoView({ behavior: 'smooth', block: 'center' });
          n1.focus({ preventScroll: true });
        }
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
        updatePrice();
      });
    }
    if (persFields) persFields.hidden = !state.personalize;

    /* Name 1 */
    $('gw-name1-input')?.addEventListener('input', e => {
      const max = nameMax(e.target);
      state.name1 = e.target.value = e.target.value.slice(0, max);
      const c = $('gw-name1-count'); if (c) c.textContent = state.name1.length + '/' + max;
      updateOrderSummary();
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
      updatePrice();
    });
    if (name2Sec) name2Sec.hidden = true;

    /* Name 2 */
    $('gw-name2-input')?.addEventListener('input', e => {
      const max = nameMax(e.target);
      state.name2 = e.target.value = e.target.value.slice(0, max);
      const c = $('gw-name2-count'); if (c) c.textContent = state.name2.length + '/' + max;
      updateOrderSummary();
    });

    /* Thread colors */
    document.querySelectorAll('[data-thread]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.thread      = btn.dataset.thread;
        state.threadHex   = btn.dataset.hex;
        state.threadLabel = btn.dataset.label || btn.dataset.thread;
        document.querySelectorAll('[data-thread]').forEach(b => { b.classList.remove('is-active'); b.setAttribute('aria-pressed', 'false'); });
        btn.classList.add('is-active');
        btn.setAttribute('aria-pressed', 'true');
        updateThreadLabel();
        updateSymbols(); updateOrderSummary();
      });
    });
    /* State + Label initial mit dem aktiven Swatch synchronisieren */
    const activeThread = document.querySelector('[data-thread].is-active') || document.querySelector('[data-thread]');
    if (activeThread) {
      state.thread      = activeThread.dataset.thread;
      state.threadHex   = activeThread.dataset.hex;
      state.threadLabel = activeThread.dataset.label || activeThread.dataset.thread;
      updateThreadLabel();
    }

    /* Symbols */
    document.querySelectorAll('[data-symbol]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.symbol = btn.dataset.symbol;
        document.querySelectorAll('[data-symbol]').forEach(b => { b.classList.remove('is-active'); b.setAttribute('aria-pressed', 'false'); });
        btn.classList.add('is-active');
        btn.setAttribute('aria-pressed', 'true');
        const posSection = $('gw-sympos-section');
        if (posSection) posSection.hidden = state.symbol === 'none';
        const priceTag = $('gw-symbol-price-tag');
        if (priceTag) priceTag.hidden = state.symbol === 'none';
        if (state.symbol === 'none' && state.symbolPos === 'between') {
          state.symbolPos = 'left';
        }
        updatePrice();
      });
    });

    /* Symbol position */
    document.querySelectorAll('[data-sympos]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.symbolPos = btn.dataset.sympos;
        document.querySelectorAll('[data-sympos]').forEach(b => { b.classList.remove('is-active'); b.setAttribute('aria-pressed', 'false'); });
        btn.classList.add('is-active');
        btn.setAttribute('aria-pressed', 'true');
        updateOrderSummary();
      });
    });

    /* Dynamische Addons (opt_text, opt_checkbox, opt_choice, opt_product) */
    initAddons();

    /* Color variants */
    document.querySelectorAll('.gw-color-swatch[data-variant-id]').forEach(btn => {
      btn.addEventListener('click', () => selectVariant(btn));
      btn.addEventListener('mouseenter', () => {
        const label = $('gw-color-label');
        if (label) label.textContent = btn.dataset.colorName;
      });
      btn.addEventListener('mouseleave', () => {
        const label = $('gw-color-label');
        const active = document.querySelector('.gw-color-swatch[data-variant-id].is-active');
        if (label && active) label.textContent = active.dataset.colorName;
      });
    });

    /* Gallery (Swipe-Carousel + Dots) */
    initGallery();

    /* Init */
    if (VARIANTS[0]) {
      const urlVariantId = new URLSearchParams(window.location.search).get('variant');
      let initBtn = urlVariantId
        ? document.querySelector('.gw-color-swatch[data-variant-id="' + urlVariantId + '"]')
        : null;
      if (!initBtn) initBtn = document.querySelector('.gw-color-swatch[data-variant-id]');
      if (initBtn) selectVariant(initBtn);
      else { state.variantPrice = VARIANTS[0].price; }
    }
    updatePrice();
    updateSymbols();
    initStickyAtc();
  }

  function updateSymbols() {
    /* Helle Schriftfarben (z. B. Weiß) wären auf dem weißen Button unsichtbar
       → dunkle Kontur dazuschalten */
    const hex = (state.threadHex || '').replace('#', '');
    let isLight = false;
    if (hex.length >= 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      isLight = (0.299 * r + 0.587 * g + 0.114 * b) > 186;
    }
    document.querySelectorAll('[data-symbol] .gw-symbol-btn__icon').forEach(el => {
      el.style.color = state.threadHex;
      el.classList.toggle('gw-symbol-icon--outlined', isLight);
    });
  }

  /* Zeigt die gewählte Schriftfarbe (Name + Farbpunkt) rechts neben dem Label */
  function updateThreadLabel() {
    const label = $('gw-thread-label');
    if (!label) return;
    label.textContent = state.threadLabel || '';
    const dot = $('gw-thread-label-dot');
    if (dot) dot.style.background = state.threadHex || 'transparent';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* Re-init after Shopify Theme Editor / Hot Reload replaces the section HTML */
  document.addEventListener('shopify:section:load', init);
})();
