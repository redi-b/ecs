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

test("Luvia listing preserves filters, sidebar, and toolbar structure", async () => {
  const [catalog, styles] = await Promise.all([
    readTemplate("pages/ProductList.astro"),
    readTemplate("styles/pages/product-list.scss"),
  ]);

  assert.ok(catalog.includes("shop-page"), "listing must have shop-page");
  assert.ok(catalog.includes("shop-sidebar"), "listing must have shop-sidebar");
  assert.ok(catalog.includes("shop-main"), "listing must have shop-main");
  assert.ok(catalog.includes("shop-main__toolbar"), "listing must have shop-main__toolbar");
  assert.ok(catalog.includes("ProductCard"), "listing must use ProductCard");
  assert.match(styles, /\.shop-sidebar[\s\S]*?overflow-y:\s*auto/);
});

test("featured promotions autoplay without taking control from the shopper", async () => {
  const carousel = await readTemplate("scripts/hero-carousel.ts");

  assert.match(carousel, /prefers-reduced-motion: reduce/);
  assert.match(carousel, /pointerenter.*stopAutoplay/);
  assert.match(carousel, /focusin.*stopAutoplay/);
  assert.match(carousel, /visibilitychange/);
  assert.match(carousel, /canScrollNext\(\)/);
});
