import assert from "node:assert/strict";
import test from "node:test";
import { deriveNexahubPalette } from "./palette";

test("deriveNexahubPalette round-trips the designed baseline", () => {
  const colors = deriveNexahubPalette("#3064d5");
  assert.equal(colors.primary, "#3064d5");
  assert.equal(colors.background, "#f8f8fc");
  assert.equal(colors.foreground, "#262732");
  assert.equal(colors.muted, "#f0f0f6");
  assert.equal(colors.accent, "#b4cffd");
  assert.equal(colors.onPrimary, "#ffffff");
});

test("deriveNexahubPalette derives a coherent palette for brand emerald", () => {
  const colors = deriveNexahubPalette("#10b981");
  assert.equal(colors.primary, "#10b981");
  assert.match(colors.background, /^#[0-9a-f]{6}$/i);
  assert.match(colors.foreground, /^#[0-9a-f]{6}$/i);
  assert.match(colors.muted, /^#[0-9a-f]{6}$/i);
  assert.match(colors.accent, /^#[0-9a-f]{6}$/i);
});

test("deriveNexahubPalette neutralizes achromatic primaries", () => {
  const gray = deriveNexahubPalette("#888888");
  assert.equal(gray.primary, "#888888");
  assert.equal(gray.background, "#f8f8f8");
  assert.equal(gray.foreground, "#282828");
  assert.equal(gray.muted, "#f1f1f1");
  assert.equal(gray.accent, "#cecece");
});
