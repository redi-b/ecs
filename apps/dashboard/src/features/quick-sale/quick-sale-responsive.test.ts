import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const workspace = await readFile(new URL("./quick-sale-workspace.tsx", import.meta.url), "utf8");
const catalog = await readFile(new URL("./quick-sale-catalog.tsx", import.meta.url), "utf8");
const cart = await readFile(new URL("./quick-sale-cart.tsx", import.meta.url), "utf8");
const surface = await readFile(new URL("./pos-cart-surface.tsx", import.meta.url), "utf8");

// Non-visual CSS structure checks: real viewport acceptance remains manual.
test("POS catalog has a shrinkable single-column track before the desktop split", () => {
  assert.match(workspace, /<main className="[^"]*min-w-0[^"]*grid-cols-1/);
  assert.match(catalog, /className="flex min-h-0 min-w-0 flex-1/);
});
test("mobile cart entry reserves its own space instead of covering the last product", () => {
  assert.doesNotMatch(workspace, /fixed inset-x-0 bottom-0 z-30/);
  assert.match(workspace, /shrink-0 border-t[^"]*safe-area-inset-bottom/);
});
test("search gets a dedicated header row until the desktop catalog/cart split", () => {
  assert.match(workspace, /order-last[^"]*lg:order-none/);
  assert.doesNotMatch(workspace, /sm:flex-nowrap/);
});
test("mobile cart respects the dynamic viewport and safe top inset", () => {
  assert.match(surface, /h-dvh/);
  assert.match(surface, /safe-area-inset-top/);
});
test("cart uses the shared mobile modal surface and restores the workspace trigger", () => {
  assert.match(cart, /<PosCartSurface/);
  assert.doesNotMatch(cart, /mobileOpen \? "fixed/);
  assert.match(workspace, /mobileTriggerRef=\{mobileCartTriggerRef\}/);
  assert.match(workspace, /ref=\{mobileCartTriggerRef\}/);
});
test("filtered catalog pages retain pagination and product options use full phone width", () => {
  assert.doesNotMatch(catalog, /hasMore && categoryId === "all"/);
  assert.match(catalog, /<SheetContent className="w-full sm:max-w-md"/);
});
