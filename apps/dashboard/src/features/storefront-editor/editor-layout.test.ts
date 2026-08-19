import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const chromeSource = await readFile(
  new URL("./editor-chrome.tsx", import.meta.url),
  "utf8",
);
const settingsSource = await readFile(
  new URL("./editor-settings.tsx", import.meta.url),
  "utf8",
);
const pageShellSource = await readFile(
  new URL("../../components/app/page-shell.tsx", import.meta.url),
  "utf8",
);
const globalStyles = await readFile(
  new URL("../../app/globals.css", import.meta.url),
  "utf8",
);

describe("storefront editor workspace containment", () => {
  it("bounds the editor grid row so settings content cannot size the outer page", () => {
    assert.match(chromeSource, /grid-rows-\[minmax\(0,1fr\)\]/);
    assert.match(
      chromeSource,
      /grid-rows-\[minmax\(0,1fr\)\][^\"]*overflow-hidden/,
    );
    assert.match(
      chromeSource,
      /flex h-full min-h-0 flex-col overflow-hidden border-t/,
    );
  });

  it("keeps settings scrolling inside its own panel", () => {
    assert.match(
      settingsSource,
      /min-h-0 flex-1 overflow-y-auto overscroll-contain/,
    );
  });

  it("locks the dashboard inset only for viewport-owned workspaces", () => {
    assert.match(pageShellSource, /data-viewport-workspace=\{viewportWorkspace/);
    assert.match(
      globalStyles,
      /\[data-slot="sidebar-inset"\]:has\(> \[data-viewport-workspace\]\)/,
    );
    assert.match(globalStyles, /height: 100svh;\s+min-height: 0;\s+overflow: hidden;/);
  });
});
