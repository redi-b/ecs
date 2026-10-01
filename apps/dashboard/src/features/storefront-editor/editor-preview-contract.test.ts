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

test("preview failures and loading use localized merchant-facing messages", () => {
  for (const key of [
    "unavailableTitle",
    "unavailableDescription",
    "failedTitle",
    "failedDescription",
    "retry",
    "openSeparately",
    "loading",
    "unsupportedTitle",
    "unsupportedDescription",
  ]) {
    assert.ok(source.includes(`t("editor.preview.${key}")`), `missing localized ${key}`);
  }
  assert.doesNotMatch(
    source,
    /confirming the preview services|registered preview renderer|\{templateKey\}<\/p>/,
  );
  assert.match(source, /setAttempt\(\(value\) => value \+ 1\)/);
});
