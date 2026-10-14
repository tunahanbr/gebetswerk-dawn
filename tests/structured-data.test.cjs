// Local rendering tests; fixtures are synthetic and never published.
// Run with NODE_PATH pointing at an installation of liquidjs 10 (see audit).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Liquid } = require('liquidjs');
const engine = new Liquid({ root: path.resolve(__dirname, '../snippets'), extname: '.liquid', strictFilters: true });
engine.registerFilter('json', value => JSON.stringify(value ?? null));
engine.registerFilter('image_url', image => image.src);
const originalDate = engine.filters.date;
engine.registerFilter('date', function (value, format) {
  return originalDate.call(this, value === 'now' ? '2026-10-14T12:00:00Z' : value, format);
});

function fixture() {
  const image = { id: 1, src: '//example.test/product.jpg' };
  return {
    canonical_url: 'https://example.test/de/products/mat?variant=123',
    request: { origin: 'https://example.test', locale: { iso_code: 'de' } },
    cart: { currency: { iso_code: 'EUR' } },
    localization: { country: { currency: { iso_code: 'EUR' } } },
    shop: { name: 'Fixture shop', currency: 'EUR' },
    product: {
      title: 'Fixture "mat"', description: '<p>Fixture description</p>', vendor: 'Fixture brand',
      images: [image], featured_image: image,
      selected_or_first_available_variant: {
        id: 123, sku: 'MAT-1', barcode: '4006381333931', price: 2490,
        compare_at_price: null, available: true, requires_shipping: true, metafields: { seo: {} },
      },
      metafields: { seo: {}, reviews: {} },
    },
  };
}
function ratings(f) {
  f.product.metafields.reviews = {
    rating: { value: { rating: 4.5, scale_min: 1, scale_max: 5 } },
    rating_count: { value: 12 },
  };
  f.product.metafields.seo.theme_rating_enabled = { value: true };
}
async function render(f) {
  const html = await engine.renderFile('gw-product-schema', f);
  const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length, 1);
  const data = JSON.parse(scripts[0][1]);
  assert.equal(data['@type'], 'Product');
  assert.equal(data.offers['@type'], 'Offer');
  assert.equal(typeof data.offers.price, 'number');
  assert.ok(data.offers.price >= 0);
  assert.equal(data.offers.priceCurrency, f.cart.currency.iso_code);
  assert.equal(new URL(data.offers.url).searchParams.get('variant'), String(f.product.selected_or_first_available_variant.id));
  assert.ok(!data.mpn);
  return { html, data };
}
test('no reviews, optional personalization: complete base offer, no invented ratings/policy/dates', async () => {
  const { data } = await render(fixture());
  assert.equal(data.offers.price, 24.9);
  for (const key of ['validFrom', 'priceValidUntil', 'hasMerchantReturnPolicy']) assert.equal(data.offers[key], undefined);
  assert.equal(data.aggregateRating, undefined);
  assert.equal(data.review, undefined);
  assert.equal(data['@id'], 'https://example.test/de/products/mat#product');
  assert.equal(data.gtin13, '4006381333931');
});
test('app remains the only rating publisher by default', async () => {
  const f = fixture(); ratings(f); delete f.product.metafields.seo.theme_rating_enabled;
  assert.equal((await render(f)).data.aggregateRating, undefined);
});
test('explicitly verified rating source: one aggregate and its real scale', async () => {
  const f = fixture(); ratings(f);
  assert.deepEqual((await render(f)).data.aggregateRating, {
    '@type': 'AggregateRating', ratingValue: 4.5, ratingCount: 12, bestRating: 5, worstRating: 1,
  });
  f.product.metafields.reviews.rating.value = { rating: 8.5, scale_min: 0, scale_max: 10 };
  assert.equal((await render(f)).data.aggregateRating.bestRating, 10);
});
test('missing, out-of-range or inconsistent rating data is not emitted', async () => {
  for (const mutate of [
    f => { f.product.metafields.reviews.rating_count.value = 0; },
    f => { f.product.metafields.reviews.rating_count.value = 1.5; },
    f => { f.product.metafields.reviews.rating.value.rating = 6; },
    f => { f.product.metafields.reviews.rating.value.rating = 0; },
    f => { f.product.metafields.reviews.rating.value.scale_max = 1; },
    f => { delete f.product.metafields.reviews.rating; },
  ]) {
    const f = fixture(); ratings(f); mutate(f);
    assert.equal((await render(f)).data.aggregateRating, undefined);
  }
});
test('personalized / non-personalized / unknown policies; variant overrides product', async () => {
  const f = fixture();
  f.product.metafields.seo.return_policy = { value: 'non_personalized' };
  let policy = (await render(f)).data.offers.hasMerchantReturnPolicy;
  assert.equal(policy.returnFees, 'https://schema.org/ReturnFeesCustomerResponsibility');
  assert.equal(policy.merchantReturnDays, 14);
  assert.deepEqual(policy.applicableCountry, ['AT', 'DE']);
  f.product.selected_or_first_available_variant.metafields.seo.return_policy = { value: 'personalized' };
  policy = (await render(f)).data.offers.hasMerchantReturnPolicy;
  assert.equal(policy.returnPolicyCategory, 'https://schema.org/MerchantReturnNotPermitted');
  assert.equal(policy.returnFees, undefined);
  assert.equal(policy.merchantReturnDays, undefined);
  f.product.selected_or_first_available_variant.metafields.seo.return_policy.value = 'mixed';
  assert.equal((await render(f)).data.offers.hasMerchantReturnPolicy, undefined);
});
test('AT/DE shipping uses a maximum; cart threshold is not inferred from one item price', async () => {
  for (const price of [2490, 8000, 10000]) {
    const f = fixture(); f.product.selected_or_first_available_variant.price = price;
    const details = (await render(f)).data.offers.shippingDetails;
    assert.deepEqual(details.map(d => d.shippingDestination.addressCountry), ['AT', 'DE']);
    for (const d of details) {
      assert.deepEqual(d.shippingRate, { '@type': 'MonetaryAmount', maxValue: 4.99, currency: 'EUR' });
      assert.equal(d.deliveryTime, undefined);
    }
  }
});
test('foreign presentment currencies and non-shippable products never get a EUR tariff', async () => {
  for (const currency of ['DKK', 'PLN', 'JPY']) {
    const f = fixture(); f.cart.currency.iso_code = currency;
    f.product.selected_or_first_available_variant.price = 100000;
    const { data } = await render(f);
    assert.equal(data.offers.price, 1000);
    assert.equal(data.offers.shippingDetails, undefined);
  }
  const f = fixture(); f.product.selected_or_first_available_variant.requires_shipping = false;
  assert.equal((await render(f)).data.offers.shippingDetails, undefined);
});
test('selected variant controls price, stock, SKU, image and unique offer ID', async () => {
  const f = fixture(); const v = f.product.selected_or_first_available_variant;
  v.id = 456; v.price = 3590; v.available = false; v.sku = 'MAT-BLACK';
  v.featured_image = { id: 2, src: 'https://example.test/black.jpg' };
  const { data } = await render(f);
  assert.equal(data.offers.price, 35.9);
  assert.equal(data.offers.availability, 'https://schema.org/OutOfStock');
  assert.equal(data.sku, 'MAT-BLACK');
  assert.equal(data.image[0], 'https://example.test/black.jpg');
  assert.equal(data.offers['@id'], 'https://example.test/de/products/mat?variant=456#offer');
});
test('sale dates only come from typed, current, ordered variant sale dates', async () => {
  const f = fixture(); const v = f.product.selected_or_first_available_variant;
  v.compare_at_price = 2990;
  assert.equal((await render(f)).data.offers.validFrom, undefined);
  v.metafields.seo.sale_starts_at = { type: 'date_time', value: '2026-10-01T00:00:00Z' };
  v.metafields.seo.sale_ends_at = { type: 'date_time', value: '2026-10-31T23:59:59Z' };
  let offer = (await render(f)).data.offers;
  assert.equal(offer.validFrom, '2026-10-01T00:00:00Z');
  assert.equal(offer.priceValidUntil, '2026-10-31T23:59:59Z');
  v.metafields.seo.sale_ends_at.value = '2026-09-01T00:00:00Z';
  assert.equal((await render(f)).data.offers.validFrom, undefined);
  delete v.metafields.seo.sale_ends_at;
  assert.equal((await render(f)).data.offers.validFrom, '2026-10-01T00:00:00Z');
  v.metafields.seo.sale_starts_at.value = '2027-01-01T00:00:00Z';
  assert.equal((await render(f)).data.offers.validFrom, undefined);
  v.metafields.seo.sale_starts_at.value = '2026-10-01T00:00:00Z'; v.compare_at_price = null;
  assert.equal((await render(f)).data.offers.validFrom, undefined);
});
test('invalid GTINs are omitted; leading zeroes and all four valid lengths survive', async () => {
  for (const barcode of ['ABC12345', '4006381333932', '00000000', '', '123', '1234567x']) {
    const f = fixture(); f.product.selected_or_first_available_variant.barcode = barcode;
    assert.equal(Object.keys((await render(f)).data).some(k => k.startsWith('gtin')), false);
  }
  for (const barcode of ['96385074', '036000291452', '4006381333931', '10012345000017']) {
    const f = fixture(); f.product.selected_or_first_available_variant.barcode = barcode;
    assert.equal((await render(f)).data['gtin' + barcode.length], barcode);
  }
});
test('quotes, newlines, closing script tags and missing images remain valid JSON/HTML', async () => {
  const f = fixture(); f.product.title = 'Quote " \\ newline\n </script><script>alert(1)</script>';
  f.product.images = []; delete f.product.featured_image;
  f.product.selected_or_first_available_variant.sku = '';
  const { html, data } = await render(f);
  assert.equal(data.name, f.product.title);
  assert.equal(data.image, undefined);
  assert.equal(data.sku, undefined);
  assert.equal((html.match(/<script/g) || []).length, 1);
});
test('product JS uses presentment currency, including currencies without minor units', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../assets/gebetswerk-product.js'), 'utf8');
  const formatter = source.slice(source.indexOf('  const moneyFormatter'), source.indexOf('\n\n  function totalCents'));
  for (const currency of ['EUR', 'DKK', 'JPY']) {
    const result = vm.runInNewContext(formatter + '\nfmt(100000)', { window: { GW_MONEY: { currency, locale: 'de' } }, Intl });
    assert.equal(result, new Intl.NumberFormat('de', { style: 'currency', currency }).format(1000));
  }
});
