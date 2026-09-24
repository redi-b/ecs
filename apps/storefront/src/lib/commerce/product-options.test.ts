import assert from "node:assert/strict";
import test from "node:test";
import { isColorOptionTitle, resolveColorSwatch } from "./product-options";

test("recognizes color option axes in either spelling", () => {
  assert.equal(isColorOptionTitle("Color"), true);
  assert.equal(isColorOptionTitle(" colour "), true);
  assert.equal(isColorOptionTitle("Material"), false);
});

test("resolves explicit and recognized swatches without depending on option order", () => {
  assert.equal(resolveColorSwatch("Bespoke", "#AABBCC"), "#aabbcc");
  assert.equal(resolveColorSwatch("#7c3aed"), "#7c3aed");
  assert.equal(resolveColorSwatch("Ocean Navy"), "#24364f");
  assert.equal(resolveColorSwatch("Sage / Natural"), "#89957e");
});

test("keeps unknown merchandising colors as text options", () => {
  assert.equal(resolveColorSwatch("Midnight Mirage"), null);
});
