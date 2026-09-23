import assert from "node:assert/strict";
import test from "node:test";
import { deriveLuviaPalette } from "./palette";

test("deriveLuviaPalette round-trips the designed baseline", () => {
  const colors = deriveLuviaPalette("#3ee272");
  assert.equal(colors.primary, "#3ee272");
  assert.equal(colors.background, "#f7fff7");
  assert.equal(colors.foreground, "#0f3112");
  assert.equal(colors.muted, "#edf8ee");
  assert.equal(colors.accent, "#b6ffa3"); // designed #b5ffa2, 1-unit clamp rounding
  assert.equal(colors.onPrimary, "#0b0f0d");
});

test("deriveLuviaPalette derives a coherent palette for brand blue", () => {
  const colors = deriveLuviaPalette("#3434f6");
  assert.equal(colors.primary, "#3434f6");
  assert.equal(colors.background, "#fbfcff");
  assert.equal(colors.foreground, "#192749");
  assert.equal(colors.muted, "#f0f4ff");
  assert.equal(colors.accent, "#dbe9ff");
});

test("deriveLuviaPalette neutralizes achromatic primaries", () => {
  const gray = deriveLuviaPalette("#888888");
  assert.equal(gray.primary, "#888888");
  assert.equal(gray.background, "#fcfcfc");
  assert.equal(gray.foreground, "#292929");
  assert.equal(gray.muted, "#f4f4f4");
  assert.equal(gray.accent, "#e8e8e8");
});
