/* Gebetswerk — Aufpreise mit Teppichen synchron halten.
   Lädt global (theme.liquid), läuft auf jeder Seite:
   - Menge der Aufpreis-Zeile = Summe der Teppich-Mengen (gleiche Variante,
     passende Personalisierungs-Property auf dem Teppich)
   - verwaiste Aufpreise (Teppich entfernt) → Menge 0
   - keine Teppiche mehr → Warenkorb komplett leeren */
(function () {
  'use strict';

  var ROUTES = window.routes || {};
  var CART_URL = ROUTES.cart_url || '/cart';
  var CART_JS_URL = CART_URL + '.js';
  var CART_UPDATE_URL = (ROUTES.cart_update_url || '/cart/update') + '.js';

  /* Ein "Kind" (Aufpreis, Gebetskette, Addon) ist jede Zeile, die per
     _TeppichVariant an einen Teppich gekoppelt ist — egal welches Produkt.
     So wird auch eine verwaiste Gebetskette als Kind erkannt und nicht
     fälschlich als echtes Produkt (Phantom-Zwischensumme) behandelt. */
  function isAddon(i) {
    return !!(i.properties && i.properties['_TeppichVariant'] !== undefined && i.properties['_TeppichVariant'] !== null);
  }

  function updateBadge(cart) {
    const realCount = cart.items
      .filter(i => !isAddon(i))
      .reduce((sum, i) => sum + i.quantity, 0);
    const link = document.getElementById('cart-icon-bubble');
    if (!link) return;
    let bubble = link.querySelector('.cart-count-bubble');
    if (realCount <= 0) {
      if (bubble) bubble.remove();
      return;
    }
    if (!bubble) {
      bubble = document.createElement('div');
      bubble.className = 'cart-count-bubble';
      link.appendChild(bubble);
    }
    const n = realCount < 100 ? realCount : '';
    bubble.innerHTML = `<span aria-hidden="true">${n}</span><span class="visually-hidden">${realCount} im Warenkorb</span>`;
  }

  /* Welche Teppich-Property muss vorhanden sein, damit die Aufpreis-Variante zählt? */
  const ADDON_PROP = {
    'Name 1': 'Name 1',
    '2. Name': 'Name 2',
    'Symbol': 'Symbol',
    'Geschenkverpackung': 'Geschenkverpackung'
  };

  let syncing = false;

  async function syncAddons() {
    if (syncing) return;
    syncing = true;
    try {
      const cart = await fetch(CART_JS_URL).then(r => r.json());
      updateBadge(cart);
      if (cart.item_count === 0) return;

      const rugs = cart.items.filter(i => !isAddon(i));
      let changed = false;

      if (rugs.length === 0) {
        await fetch('/cart/clear.js', { method: 'POST' });
        changed = true;
      } else {
        const updates = {};
        cart.items.forEach(a => {
          if (!isAddon(a)) return;
          const ref = (a.properties && a.properties['_ref']) || '';
          let matchRugs;
          if (ref) {
            /* Präzise Kopplung: jede Aufpreis-Zeile gehört genau zu dem Teppich
               mit demselben _ref → keine Doppelzählung bei mehreren gleichfarbigen
               Teppichen, und beim Entfernen des Teppichs fällt der Aufpreis auf 0 */
            matchRugs = rugs.filter(r => r.properties && r.properties['_ref'] === ref);
          } else {
            /* Fallback für ältere Warenkorb-Zeilen ohne _ref */
            const tv = (a.properties && a.properties['_TeppichVariant']) || '';
            const propKey = ADDON_PROP[a.variant_title] || null;
            matchRugs = rugs
              .filter(r => String(r.variant_id) === tv)
              .filter(r => !propKey || (r.properties && r.properties[propKey]));
          }
          const want = matchRugs.reduce((s, r) => s + r.quantity, 0);
          if (want !== a.quantity) updates[a.key] = want;
        });
        if (Object.keys(updates).length > 0) {
          await fetch(CART_UPDATE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ updates })
          });
          changed = true;
        }
      }

      if (!changed) return;

      const newCart = await fetch(CART_JS_URL).then(r => r.json());
      updateBadge(newCart);
      document.dispatchEvent(new CustomEvent('cart:refresh', { bubbles: true }));

      if (newCart.item_count === 0) {
        setTimeout(() => window.location.reload(), 150);
      } else if (window.location.pathname === CART_URL) {
        window.location.reload();
      }
    } catch (e) {
      (window.gwSyncLog = window.gwSyncLog || []).push('error: ' + e.message);
    } finally {
      syncing = false;
    }
  }
  window.gwSyncAddons = syncAddons;

  /* Nach jeder Cart-API-Änderung (Menge geändert, Artikel entfernt, hinzugefügt)
     erneut synchronisieren — fängt auch Dawn's eigene Cart-Updates ab */
  const origFetch = window.fetch;
  window.fetch = function () {
    const url = typeof arguments[0] === 'string' ? arguments[0] : (arguments[0] && arguments[0].url) || '';
    const p = origFetch.apply(this, arguments);
    if (/\/cart\/(change|update|add)/.test(url) && !syncing) {
      p.then(function () { setTimeout(syncAddons, 100); }).catch(function () {});
    }
    return p;
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', syncAddons);
  } else {
    syncAddons();
  }
})();
