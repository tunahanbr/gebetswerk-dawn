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
      /* Auf der aktuellen Seite bleiben; insbesondere nie aus dem Warenkorb
         direkt in den Checkout springen. */
      window.location.reload();
    }).catch(function () {
      if (button) {
        button.disabled = false;
        button.textContent = code ? 'Einlösen' : 'Entfernen';
      }
      if (source.tagName === 'FORM') setStatus(source, 'Der Gutscheincode konnte nicht aktualisiert werden.', true);
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
