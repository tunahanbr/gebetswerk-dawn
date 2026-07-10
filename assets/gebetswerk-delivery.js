/* Gebetswerk — dynamische Lieferzeit (Standard / Express)
   Rendert in jedes .gw-delivery-Element ein voraussichtliches Lieferdatum.

   Rechenmodell in drei Schritten, jeweils mit eigenem Tages-Kalender:
     1. Bearbeitung   — zählt nur an den gewählten Bearbeitungstagen
                        (data-work-days, auch Wochenende möglich). Bestellungen
                        nach Redaktionsschluss (data-cutoff "HH:MM") an einem
                        Bearbeitungstag starten einen Tag später.
     2. Versandübergabe — das fertige Paket geht am selben Tag raus, wenn er
                        ein Versandtag ist (data-ship-days), sonst am nächsten
                        Versandtag.
     3. Versanddauer  — zählt Mo–Fr; bei data-sat-delivery="true" zählt auch
                        der Samstag als Zustelltag.

   Tages-Masken sind 7-stellige Bitstrings, Index = Date.getDay() (0 = Sonntag),
   z. B. "0111110" = Mo–Fr.

   - Auf der Produktseite beobachtet es (data-auto-express) die Express-Checkbox
     und schaltet automatisch zwischen Standard- und Express-Zustand um.
   - Im Warenkorb kommt der Zustand statisch aus Liquid (data-express).
*/
(function () {
  'use strict';

  var WEEKDAYS = ['So.', 'Mo.', 'Di.', 'Mi.', 'Do.', 'Fr.', 'Sa.'];
  var MONTHS = ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sep.', 'Okt.', 'Nov.', 'Dez.'];

  /* Eine Maske ohne einzigen aktiven Tag würde endlos iterieren. */
  function validMask(mask, fallback) {
    return typeof mask === 'string' && mask.length === 7 && mask.indexOf('1') !== -1 ? mask : fallback;
  }

  function isDay(mask, d) {
    return mask.charAt(d.getDay()) === '1';
  }

  /* Fügt n Tage hinzu, gezählt werden nur Tage der Maske. */
  function addDays(start, n, mask) {
    var d = new Date(start.getTime());
    var added = 0;
    while (added < n) {
      d.setDate(d.getDate() + 1);
      if (isDay(mask, d)) added++;
    }
    return d;
  }

  /* Erster Masken-Tag am oder nach dem Startdatum. */
  function nextOnOrAfter(start, mask) {
    var d = new Date(start.getTime());
    while (!isDay(mask, d)) d.setDate(d.getDate() + 1);
    return d;
  }

  /* "14:00", "14" → {h, m}; Unlesbares fällt auf 14:00 zurück. */
  function parseCutoff(value) {
    var m = /^\s*(\d{1,2})(?::(\d{1,2}))?\s*$/.exec(value || '');
    if (!m) return { h: 14, m: 0 };
    return { h: Math.min(23, parseInt(m[1], 10)), m: m[2] ? Math.min(59, parseInt(m[2], 10)) : 0 };
  }

  function fmtDate(d) {
    return WEEKDAYS[d.getDay()] + ', ' + d.getDate() + '. ' + MONTHS[d.getMonth()];
  }

  function num(v, fallback) {
    var n = parseInt(v, 10);
    return isNaN(n) ? fallback : n;
  }

  function computeDate(el, prodDays, transitDays) {
    var work = validMask(el.dataset.workDays, '1111111');
    var ship = validMask(el.dataset.shipDays, '0111110');
    var transit = el.dataset.satDelivery === 'true' ? '0111111' : '0111110';
    var cutoff = parseCutoff(el.dataset.cutoff);

    /* Redaktionsschluss greift nur an Bearbeitungstagen: an einem freien Tag
       beginnt die Zählung ohnehin erst am nächsten Bearbeitungstag. */
    var now = new Date();
    var start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (isDay(work, start) && (now.getHours() > cutoff.h || (now.getHours() === cutoff.h && now.getMinutes() >= cutoff.m))) {
      start.setDate(start.getDate() + 1);
    }

    var prodDone = addDays(start, prodDays, work);
    var handoff = nextOnOrAfter(prodDone, ship);
    return addDays(handoff, transitDays, transit);
  }

  function render(el) {
    var express = el.dataset.express === 'true';

    var prodMin, prodMax, shipMin, shipMax;
    if (express) {
      prodMin = num(el.dataset.expProdMin, 1);
      prodMax = num(el.dataset.expProdMax, 1);
      shipMin = num(el.dataset.expShipMin, 1);
      shipMax = num(el.dataset.expShipMax, 2);
    } else {
      prodMin = num(el.dataset.prodMin, 2);
      prodMax = num(el.dataset.prodMax, 4);
      shipMin = num(el.dataset.shipMin, 1);
      shipMax = num(el.dataset.shipMax, 4);
    }

    var earliest = computeDate(el, prodMin, shipMin);
    var latest = computeDate(el, prodMax, shipMax);
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
