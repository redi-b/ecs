import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./editor-preview.tsx", import.meta.url), "utf8");

test("preview device presets preserve responsive width while fitting the canvas", () => {
  assert.match(source, /viewport === "desktop" \? 1440 : 390/);
  assert.match(source, /data-preview-viewport=\{viewport\}/);
  assert.match(source, /transform: `scale\(\$\{previewScale\}\)`/);
  assert.match(source, /width: `\$\{targetPreviewWidth\}px`/);
});
