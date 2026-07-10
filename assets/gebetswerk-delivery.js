/* Gebetswerk — dynamische Lieferzeit (Standard / Express)
   Rendert in jedes .gw-delivery-Element ein voraussichtliches Lieferdatum.
   - Werktags-Logik: Wochenenden werden übersprungen.
   - Auf der Produktseite beobachtet es (data-auto-express) die Express-Checkbox
     und schaltet automatisch zwischen Standard- und Express-Zustand um.
   - Im Warenkorb kommt der Zustand statisch aus Liquid (data-express).
*/
(function () {
  'use strict';

  var WEEKDAYS = ['So.', 'Mo.', 'Di.', 'Mi.', 'Do.', 'Fr.', 'Sa.'];
  var MONTHS = ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sep.', 'Okt.', 'Nov.', 'Dez.'];

  /* Fügt n Werktage (Mo–Fr) zu einem Datum hinzu. */
  function addBusinessDays(start, n) {
    var d = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    var added = 0;
    while (added < n) {
      d.setDate(d.getDate() + 1);
      var wd = d.getDay();
      if (wd !== 0 && wd !== 6) added++;
    }
    return d;
  }

  function fmtDate(d) {
    return WEEKDAYS[d.getDay()] + ', ' + d.getDate() + '. ' + MONTHS[d.getMonth()];
  }

  /* Bestellungen nach Redaktionsschluss (Standard 14 Uhr) starten am nächsten Tag. */
  function startDate(cutoffHour) {
    var now = new Date();
    if (now.getHours() >= cutoffHour) now.setDate(now.getDate() + 1);
    return now;
  }

  function num(v, fallback) {
    var n = parseInt(v, 10);
    return isNaN(n) ? fallback : n;
  }

  function render(el) {
    var express = el.dataset.express === 'true';
    var cutoff = num(el.dataset.cutoffHour, 14);
    var start = startDate(cutoff);

    var min, max;
    if (express) {
      min = num(el.dataset.expMin, 1);
      max = num(el.dataset.expMax, 3);
    } else {
      min = num(el.dataset.prodMin, 2) + num(el.dataset.shipMin, 1);
      max = num(el.dataset.prodMax, 4) + num(el.dataset.shipMax, 4);
    }

    var earliest = addBusinessDays(start, min);
    var latest = addBusinessDays(start, max);
    var text = earliest.getTime() === latest.getTime()
      ? fmtDate(earliest)
      : fmtDate(earliest) + ' – ' + fmtDate(latest);

    el.querySelectorAll('[data-date]').forEach(function (span) {
      span.textContent = text;
    });
    el.querySelectorAll('[data-state]').forEach(function (row) {
      row.hidden = (row.dataset.state === 'express') !== express;
    });
    el.dataset.gwDeliveryReady = 'true';
  }

  /* Produktseite: Express-Checkbox beobachten (field_key = "Expressanfertigung"). */
  function bindExpressToggle(el) {
    var cb = document.querySelector('[data-addon="checkbox"][data-fkey="Expressanfertigung"]');
    if (!cb) return;
    var sync = function () {
      el.dataset.express = cb.checked ? 'true' : 'false';
      render(el);
    };
    cb.addEventListener('change', sync);
    sync();
  }

  function boot() {
    document.querySelectorAll('.gw-delivery').forEach(function (el) {
      if (el.dataset.gwDeliveryReady !== 'true') {
        render(el);
        if (el.dataset.autoExpress === 'true') bindExpressToggle(el);
      }
    });
  }

  /*
   * Cart Drawer sections are replaced by Shopify after add/remove/quantity
   * updates. Scripts inside those HTML fragments are not reliably executed,
   * so the original one-time boot left the date at "…". Keep one observer
   * alive and initialize only newly inserted delivery boxes.
   */
  if (window.GW_DELIVERY_INIT) {
    if (window.GW_DELIVERY_BOOT) window.GW_DELIVERY_BOOT();
    return;
  }
  window.GW_DELIVERY_INIT = true;
  window.GW_DELIVERY_BOOT = boot;

  if (document.readyState !== 'loading') boot();
  else document.addEventListener('DOMContentLoaded', boot);

  var observer = new MutationObserver(function (mutations) {
    var hasNewNodes = mutations.some(function (mutation) {
      return Array.prototype.some.call(mutation.addedNodes, function (node) {
        return node.nodeType === 1;
      });
    });
    if (hasNewNodes) boot();
  });

  function observe() {
    if (document.body) observer.observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState !== 'loading') observe();
  else document.addEventListener('DOMContentLoaded', observe);
})();
