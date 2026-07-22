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

test("shiftColorRelativeToPrimary preserves accent hue offset from seed primary", () => {
  const seed = CLASSIC_DARK_SEED;
  const seedP = hexToHsl(seed.colors.primary)!;
  const seedA = hexToHsl(seed.colors.accent)!;
  const seedOffset = ((seedA.h - seedP.h) % 360 + 360) % 360;

  const newPrimary = "#c45c5c";
  const shiftedAccent = shiftColorRelativeToPrimary(
    seed.colors.accent,
    seed.colors.primary,
    newPrimary,
  );
  const newP = hexToHsl(newPrimary)!;
  const newA = hexToHsl(shiftedAccent)!;
  const newOffset = ((newA.h - newP.h) % 360 + 360) % 360;

  // Allow small rounding drift
  const delta = Math.min(
    Math.abs(newOffset - seedOffset),
    360 - Math.abs(newOffset - seedOffset),
  );
  assert.ok(delta < 3, `hue offset drift too large: ${delta}`);
});

test("generateThemeFromSeed with red primary keeps dark surface and readable contrast", () => {
  const colors = generateThemeFromSeed("#c45c5c", CLASSIC_DARK_SEED);
  assert.ok(relativeLuminance(colors.background) < 0.25);
  assert.ok(contrastRatio(colors.background, colors.foreground) >= 4.5);
  assert.ok(contrastRatio(colors.primary, colors.onPrimary) >= 3);
});

test("light seed is available for light surface mode", () => {
  assert.equal(CLASSIC_LIGHT_SEED.surfaceMode, "light");
  const colors = generateThemeFromPrimary(CLASSIC_LIGHT_SEED.colors.primary, "light");
  assert.ok(relativeLuminance(colors.background) > 0.7);
});
