import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const readTemplate = (path: string) =>
  readFile(new URL(`../templates/luvia/v1/${path}`, import.meta.url), "utf8");

test("storefront overlays share one authoritative page scroll lock", async () => {
  const [client, layoutStyles] = await Promise.all([
    readTemplate("scripts/client.ts"),
    readTemplate("styles/_reset.scss"),
  ]);

  assert.match(client, /const syncPageScrollLock = \(\) =>/);
  assert.match(client, /document\.documentElement\.toggleAttribute\("data-overlay-open", locked\)/);
  assert.match(client, /setHeaderSurface\(null\)[\s\S]*?lastFocused/);
  assert.match(layoutStyles, /html\[data-overlay-open\][\s\S]*overflow:\s*hidden/);
});

test("product and address disclosures animate their content instead of snapping", async () => {
  const [product, client, account] = await Promise.all([
    readTemplate("pages/Product.astro"),
    readTemplate("scripts/client.ts"),
    readTemplate("pages/Account.astro"),
  ]);

  assert.match(product, /class="product-accordions"/);
  assert.match(client, /disclosure\.animate/);
  assert.match(account, /data-address-toggle/);
});

test("catalog facets support persistent batch filtering and a dedicated scroll region", async () => {
  const [catalog, styles, animation] = await Promise.all([
    readTemplate("pages/ProductList.astro"),
    readTemplate("styles/pages/product-list.scss"),
    readFile(new URL("./browser/animate-details.ts", import.meta.url), "utf8"),
  ]);

  assert.match(catalog, /initAnimatedDetails\(document, "\.filter-menu"/);
  assert.doesNotMatch(catalog, /other\.open\s*=\s*false/);
  assert.doesNotMatch(catalog, /menu\.open\s*=\s*false/);
  assert.match(styles, /\.catalog-filter__scroll\s*\{[^}]*overflow-y:\s*auto/);
  assert.match(catalog, /catalog-filter__scroll/);
  assert.match(catalog, /filter-footer[\s\S]*catalog-filter__active[\s\S]*filter-clear[\s\S]*filter-apply/);
  assert.match(animation, /animation\.finished/);
  assert.match(animation, /if \(!opening\) details\.open = false/);
});

test("featured promotions autoplay without taking control from the shopper", async () => {
  const carousel = await readTemplate("scripts/hero-carousel.ts");

  assert.match(carousel, /prefers-reduced-motion: reduce/);
  assert.match(carousel, /pointerenter.*stopAutoplay/);
  assert.match(carousel, /focusin.*stopAutoplay/);
  assert.match(carousel, /visibilitychange/);
  assert.match(carousel, /canScrollNext\(\)/);
});

test("custom dropdowns close outside, support Escape, and expose listbox semantics", async () => {
  const [component, client] = await Promise.all([
    readTemplate("components/CustomDropdown.astro"),
    readTemplate("scripts/client.ts"),
  ]);

  assert.match(component, /aria-haspopup="listbox"/);
  assert.match(component, /role="option"/);
  assert.match(client, /document\.addEventListener\("pointerdown"/);
  assert.match(client, /event\.key === "Escape"/);
  assert.match(client, /event\.key === "ArrowDown"/);
});

test("checkout provides mobile summary disclosure and visible journey context", async () => {
  const [checkout, styles] = await Promise.all([
    readTemplate("pages/Checkout.astro"),
    readTemplate("styles/pages/checkout.scss"),
  ]);

  assert.match(checkout, /class="checkout__steps"/);
  assert.match(checkout, /class="checkout-summary__toggle"/);
  assert.match(checkout, /aria-controls="checkout-summary-body"/);
  assert.match(styles, /\.checkout-summary\[data-expanded\] \.checkout-summary__body/);
  assert.match(styles, /@media \(max-width: 560px\)[\s\S]*?grid-template-columns:\s*1fr/);
});

test("Luvia preview journey passes one category foundation across commerce pages", async () => {
  const pages = ["Cart.astro", "Checkout.astro", "Product.astro", "ProductList.astro", "OrderConfirm.astro"];
  const sources = await Promise.all(pages.map((page) => readTemplate(`pages/${page}`)));
  assert.ok(sources.every((source) => /categories=\{categories\}/.test(source)));
});

test("the shared shell normalizes preview routes and removes the retired request-item link", async () => {
  const [header, footer] = await Promise.all([
    readTemplate("components/Header.astro"),
    readTemplate("components/Footer.astro"),
  ]);

  assert.match(header, /replace\(\/\^\\\/demo\\\/storefront\\\/luvia/);
  assert.match(header, /header\.navigation\.filter\(\(item\) => item\.href !== "\/request-item"\)/);
  assert.match(footer, /footer\.quickLinks\.filter\(\(item\) => item\.href !== "\/request-item"\)/);
});

test("catalog filters keep search context and use real price and option controls", async () => {
  const catalog = await readTemplate("pages/ProductList.astro");

  assert.match(catalog, /name="price_min"/);
  assert.match(catalog, /name="price_max"/);
  assert.match(catalog, /name="option"/);
  assert.match(catalog, /filters\.q && <input type="hidden" name="q"/);
  assert.doesNotMatch(catalog, /class="catalog-search"/);
});

test("wishlist feedback fills only the heart artwork", async () => {
  const [cardStyles, heroStyles] = await Promise.all([
    readTemplate("styles/components/_product-card.scss"),
    readTemplate("styles/pages/index.scss"),
  ]);

  assert.match(cardStyles, /\.product-card__heart\[aria-pressed="true"\] svg\[data-icon\] path \{ fill: currentColor; \}/);
  assert.match(heroStyles, /\.promo__media button\[aria-pressed="true"\] svg\[data-icon\] path \{ fill: currentColor; \}/);
  assert.doesNotMatch(heroStyles, /button\[aria-pressed="true"\][^{]*\{[^}]*background:/);
});

test("shared page context owns shell categories for every storefront route", async () => {
  const [context, contact, wishlist, cart, checkout] = await Promise.all([
    readFile(new URL("./page-context.ts", import.meta.url), "utf8"),
    readFile(new URL("../pages/contact.astro", import.meta.url), "utf8"),
    readFile(new URL("../pages/wishlist.astro", import.meta.url), "utf8"),
    readFile(new URL("../pages/cart.astro", import.meta.url), "utf8"),
    readFile(new URL("../pages/checkout/index.astro", import.meta.url), "utf8"),
  ]);

  assert.match(context, /categories: StoreCategory\[\]/);
  for (const route of [contact, wishlist, cart, checkout]) {
    assert.match(route, /categories=\{ctx\.categories\}/);
  }
});

test("wishlist hydrates legacy saved entries from current catalog products", async () => {
  const [route, page] = await Promise.all([
    readFile(new URL("../pages/wishlist.astro", import.meta.url), "utf8"),
    readTemplate("pages/Wishlist.astro"),
  ]);

  assert.match(route, /listStoreProducts/);
  assert.match(route, /products=\{products\}/);
  assert.match(page, /data-wishlist-products/);
  assert.match(page, /catalogByPath/);
  assert.match(page, /data-wishlist-remove-icon><Icon name="trash"/);
});

test("Luvia derives essential filter facets when the backend omits facet metadata", async () => {
  const catalog = await readTemplate("pages/ProductList.astro");
  assert.match(catalog, /resolvedFacets/);
  assert.match(catalog, /derivedPrice/);
  assert.match(catalog, /derivedOptions/);
});

test("cart drawer exits through the same right edge it entered from", async () => {
  const styles = await readTemplate("styles/components/_cart-drawer.scss");
  assert.match(styles, /\.cart-drawer\[data-closing\]\s*\{\s*transform:\s*translateX\(102%\)/);
  assert.doesNotMatch(styles, /\.cart-drawer\[data-closing\][^{]*\{[^}]*translateX\(-/);
});
