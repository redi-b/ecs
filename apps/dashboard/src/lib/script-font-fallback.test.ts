import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(relativePath: string) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

test("dashboard uses Ethiopic as a script fallback instead of replacing the Latin face", () => {
  const layout = source("../app/layout.tsx");
  const styles = source("../app/globals.css");

  assert.match(layout, /notoEthiopic\.variable/);
  assert.doesNotMatch(layout, /notoEthiopic\.className/);
  assert.match(styles, /--font-sans:\s*var\(--font-geist-sans\), var\(--font-ethiopic\)/);
});

test("storefront font contract scopes Noto to Ethiopic glyphs without a locale-wide override", () => {
  const styles = source("../../../storefront/src/components/shell/StorefrontFonts.astro");

  assert.match(styles, /unicode-range:\s*U\+1200-137F/);
  assert.doesNotMatch(styles, /:lang\(am\)\s*\{[^}]*font-family/s);
});
