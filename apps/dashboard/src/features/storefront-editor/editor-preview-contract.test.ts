import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./editor-preview.tsx", import.meta.url), "utf8");

test("embedded desktop previews preserve desktop responsive state while fitting the canvas", () => {
  assert.match(source, /const desktopPreviewWidth = 1440/);
  assert.match(source, /data-preview-viewport=\{scalesDesktopToFit \? "desktop-scaled" : "responsive"\}/);
  assert.match(source, /transform: `scale\(\$\{previewScale\}\)`/);
  assert.match(source, /width: `\$\{desktopPreviewWidth\}px`/);
});
