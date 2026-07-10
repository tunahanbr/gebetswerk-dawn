/* Gebetswerk — Gutscheincodes über Shopifys native Discount-Route anwenden. */
(function () {
  'use strict';

  function setStatus(form, message, isError) {
    var status = form.querySelector('[data-discount-status]');
    if (!status) return;
    status.hidden = false;
    status.textContent = message;
    status.dataset.state = isError ? 'error' : 'success';
  }

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

    var baseUrl = form.dataset.discountBaseUrl || '/discount/';
    var redirect = form.dataset.discountRedirect || '/cart';
    var separator = redirect.indexOf('?') === -1 ? '?' : '&';
    var target = baseUrl + encodeURIComponent(code) + separator + 'redirect=' + encodeURIComponent(redirect);
    var button = form.querySelector('button[type="submit"]');
    if (button) {
      button.disabled = true;
      button.textContent = 'Wird geprüft …';
    }
    window.location.assign(target);
  });
})();
