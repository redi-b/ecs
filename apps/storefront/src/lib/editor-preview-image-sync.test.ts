import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../pages/preview.astro", import.meta.url), "utf8");

test("editor preview restores image bindings when undo clears a draft value", () => {
  assert.match(source, /editorOriginalSrc/);
  assert.match(source, /node\.removeAttribute\('src'\)/);
  assert.match(source, /editorOriginalBackgroundImage/);
  assert.match(source, /node\.style\.removeProperty\('--hero-bg'\)/);
  assert.doesNotMatch(
    source,
    /typeof fields\[path\] === 'string'\) node\.src = fields\[path\]/,
  );
});
