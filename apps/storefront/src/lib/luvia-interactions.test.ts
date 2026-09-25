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
