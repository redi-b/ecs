import assert from "node:assert/strict";
import test from "node:test";

import {
  contrastRatio,
  contrastingInk,
  generateThemeFromPrimary,
  inferSurfaceMode,
  isHexColor,
  normalizeHex,
  relativeLuminance,
} from "./palette";

test("normalizeHex expands short form", () => {
  assert.equal(normalizeHex("#abc"), "#aabbcc");
  assert.equal(normalizeHex("0f766e"), "#0f766e");
});

test("isHexColor validates", () => {
  assert.equal(isHexColor("#0f766e"), true);
  assert.equal(isHexColor("nope"), false);
});

test("contrastingInk picks readable ink on fills", () => {
  assert.equal(contrastingInk("#000000"), "#ffffff");
  assert.equal(contrastingInk("#ffffff"), "#0b0f0d");
  assert.ok(contrastRatio("#0f766e", contrastingInk("#0f766e")) >= 3);
});

test("generateThemeFromPrimary light mode yields light background", () => {
  const colors = generateThemeFromPrimary("#0f766e", "light");
  assert.ok(relativeLuminance(colors.background) > 0.7);
  assert.ok(relativeLuminance(colors.foreground) < 0.3);
  assert.ok(isHexColor(colors.primary));
  assert.ok(isHexColor(colors.accent));
  assert.ok(contrastRatio(colors.primary, colors.onPrimary) >= 3);
});

test("generateThemeFromPrimary dark mode yields dark background", () => {
  const colors = generateThemeFromPrimary("#9bc4a0", "dark");
  assert.ok(relativeLuminance(colors.background) < 0.2);
  assert.ok(relativeLuminance(colors.foreground) > 0.7);
  assert.ok(contrastRatio(colors.primary, colors.onPrimary) >= 3);
});

test("inferSurfaceMode from background", () => {
  assert.equal(inferSurfaceMode("#0b0f0d"), "dark");
  assert.equal(inferSurfaceMode("#fafafa"), "light");
});
