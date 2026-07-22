import assert from "node:assert/strict";
import test from "node:test";

import {
  CLASSIC_DARK_SEED,
  CLASSIC_LIGHT_SEED,
  contrastRatio,
  contrastingInk,
  generateThemeFromPrimary,
  generateThemeFromSeed,
  hexToHsl,
  inferSurfaceMode,
  isHexColor,
  normalizeHex,
  relativeLuminance,
  shiftColorRelativeToPrimary,
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

test("accent stays brand-adjacent for blue primary (not neon green)", () => {
  const colors = generateThemeFromSeed("#2b7fd4", CLASSIC_DARK_SEED);
  const brand = hexToHsl(colors.primary)!;
  const accent = hexToHsl(colors.accent)!;
  let dh = accent.h - brand.h;
  while (dh > 180) dh -= 360;
  while (dh < -180) dh += 360;
  assert.ok(Math.abs(dh) <= 42, `accent too far from brand: ${dh}°`);
  assert.ok(contrastRatio(colors.accent, colors.onAccent) >= 2.5);
});

test("body text stays low saturation when brand is red", () => {
  const colors = generateThemeFromSeed("#c45c5c", CLASSIC_DARK_SEED);
  const fg = hexToHsl(colors.foreground)!;
  assert.ok(fg.s <= 10, `foreground too saturated: ${fg.s}`);
  assert.ok(fg.l >= 85, `foreground too dark: ${fg.l}`);
  assert.ok(relativeLuminance(colors.background) < 0.25);
  assert.ok(contrastRatio(colors.background, colors.foreground) >= 4.5);
  assert.ok(contrastRatio(colors.primary, colors.onPrimary) >= 3);
});

test("light seed is available for light surface mode", () => {
  assert.equal(CLASSIC_LIGHT_SEED.surfaceMode, "light");
  const colors = generateThemeFromPrimary(CLASSIC_LIGHT_SEED.colors.primary, "light");
  assert.ok(relativeLuminance(colors.background) > 0.7);
});
