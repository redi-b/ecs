import assert from "node:assert/strict";
import test from "node:test";
import { deriveAfroPalette } from "./palette";

test("deriveAfroPalette round-trips the designed baseline", () => {
  const colors = deriveAfroPalette("#ff720a");
  assert.equal(colors.primary, "#ff720a");
  assert.equal(colors.background, "#fffbf8");
  assert.equal(colors.foreground, "#1c120d");
  assert.equal(colors.muted, "#f8f2ed");
  assert.equal(colors.accent, "#ffc599");
});

test("deriveAfroPalette derives a coherent palette for brand sapphire", () => {
  const colors = deriveAfroPalette("#1d4ed8");
  assert.equal(colors.primary, "#1d4ed8");
  assert.match(colors.background, /^#[0-9a-f]{6}$/i);
  assert.match(colors.foreground, /^#[0-9a-f]{6}$/i);
  assert.match(colors.muted, /^#[0-9a-f]{6}$/i);
  assert.match(colors.accent, /^#[0-9a-f]{6}$/i);
});

test("deriveAfroPalette neutralizes achromatic primaries", () => {
  const gray = deriveAfroPalette("#888888");
  assert.equal(gray.primary, "#888888");
  assert.equal(gray.background, "#fcfcfc");
  assert.equal(gray.foreground, "#151515");
  assert.equal(gray.muted, "#f3f3f3");
  assert.equal(gray.accent, "#d2d2d2");
});
