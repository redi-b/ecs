import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const readTemplate = (path: string) =>
  readFile(new URL(`../templates/luvia/v1/${path}`, import.meta.url), "utf8");

test("storefront overlays share one authoritative page scroll lock", async () => {
  const [layout, layoutStyles, motion] = await Promise.all([
    readTemplate("Layout.astro"),
    readTemplate("styles/layout.scss"),
    readTemplate("scripts/motion.ts"),
  ]);

  assert.match(layout, /const syncPageScrollLock = \(\) =>/);
  assert.match(layout, /document\.documentElement\.toggleAttribute\("data-overlay-open", locked\)/);
  assert.match(layout, /setHeaderSurface\(null\); lastFocused/);
  assert.match(layoutStyles, /html\[data-overlay-open\].*overflow: hidden/);
  assert.match(motion, /if \(locked\) lenis\.stop\(\)/);
  assert.match(motion, /else lenis\.start\(\)/);
});

test("product and address disclosures animate their content instead of snapping", async () => {
  const [product, account] = await Promise.all([
    readTemplate("Product.astro"),
    readTemplate("Account.astro"),
  ]);

  assert.match(product, /\.lv-product-accordions details/);
  assert.match(product, /disclosure\.animate/);
  assert.match(account, /const setAddressFormOpen =/);
  assert.match(account, /form\.animate/);
});
