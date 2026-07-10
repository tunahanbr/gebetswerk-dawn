/* Gebetswerk — Gutscheincodes über Shopifys Cart-Ajax-API verwalten. */
(function () {
  'use strict';

  function setStatus(form, message, isError) {
    var status = form.querySelector('[data-discount-status]');
    if (!status) return;
    status.hidden = false;
    status.textContent = message;
    status.dataset.state = isError ? 'error' : 'success';
  }

  function updateDiscount(code, source) {
    var updateUrl = source.dataset.discountUpdateUrl || '/cart/update.js';
    var discountDetails = source.closest ? source.closest('details') : null;
    var wasOpen = discountDetails ? discountDetails.open : false;
    var button = source.matches && source.matches('button')
      ? source
      : source.querySelector('button[type="submit"]');
    if (button) {
      button.disabled = true;
      button.textContent = code ? 'Wird geprüft …' : 'Wird entfernt …';
    }

    return fetch(updateUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ discount: code })
    }).then(function (response) {
      if (!response.ok) throw new Error('Discount update failed');
      return response.json();
    }).then(function () {
      return refreshCartDrawer(wasOpen);
    }).catch(function () {
      if (button) {
        button.disabled = false;
        button.textContent = code ? 'Einlösen' : 'Entfernen';
      }
      if (source.tagName === 'FORM') setStatus(source, 'Der Gutscheincode konnte nicht aktualisiert werden.', true);
    });
  }

  function refreshCartDrawer(wasOpen) {
    var drawer = document.querySelector('cart-drawer');
    if (!drawer || typeof drawer.renderContents !== 'function') {
      /* Auf der normalen Warenkorb-Seite bleibt der bestehende Seiten-Refresh
         als Fallback aktiv; im Drawer wird nur dessen Inhalt ersetzt. */
      window.location.reload();
      return;
    }

    var sectionIds = drawer.getSectionsToRender().map(function (section) { return section.id; });
    var root = window.Shopify && window.Shopify.routes && window.Shopify.routes.root
      ? window.Shopify.routes.root
      : '/';
    var url = root + '?sections=' + encodeURIComponent(sectionIds.join(','));

    return fetch(url, { headers: { Accept: 'application/json' } })
      .then(function (response) {
        if (!response.ok) throw new Error('Cart refresh failed');
        return response.json();
      })
      .then(function (sections) {
        drawer.renderContents({ sections: sections });
        if (wasOpen) {
          var updatedDetails = drawer.querySelector('.gw-drawer-discount');
          if (updatedDetails) updatedDetails.open = true;
        }
      });
  }

  document.addEventListener('click', function (event) {
    var removeButton = event.target.closest('[data-gw-remove-discount]');
    if (!removeButton) return;
    event.preventDefault();
    updateDiscount('', removeButton);
  });

  document.addEventListener('submit', function (event) {
    var form = event.target.closest('[data-gw-discount-form]');
    if (!form) return;
    event.preventDefault();

    var input = form.querySelector('[name="discount"]');
    var code = input ? input.value.trim() : '';
    if (!code) {
      setStatus(form, 'Bitte gib einen Gutscheincode ein.', true);
      if (input) input.focus();
      return;
    }

    updateDiscount(code, form);
  });
})();
