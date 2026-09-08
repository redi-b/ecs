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
const runtimeSource = await readFile(
  new URL("./storefront-visual-editor.tsx", import.meta.url),
  "utf8",
);
const editorPageSource = await readFile(
  new URL("../../app/admin/(dashboard)/editor/page.tsx", import.meta.url),
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
  it("lets the normal editor page grow while containing true fullscreen", () => {
    assert.doesNotMatch(editorPageSource, /viewportWorkspace/);
    assert.match(chromeSource, /isFullscreen \? "h-dvh overflow-hidden" : "overflow-visible"/);
    assert.match(chromeSource, /h-\[clamp\(34rem,72dvh,52rem\)\]/);
    assert.match(runtimeSource, /!isFullscreen && "min-h-\[36rem\]"/);
  });

  it("contains settings scrolling only in fullscreen", () => {
    assert.match(
      settingsSource,
      /contained && "overflow-y-auto overscroll-contain"/,
    );
    assert.match(chromeSource, /contained=\{isFullscreen\}/);
  });

  it("retains the generic viewport-workspace contract for other immersive routes", () => {
    assert.match(pageShellSource, /data-viewport-workspace=\{viewportWorkspace/);
    assert.match(
      globalStyles,
      /\[data-slot="sidebar-inset"\]:has\(> \[data-viewport-workspace\]\)/,
    );
    assert.match(globalStyles, /height: 100svh;\s+min-height: 0;\s+overflow: hidden;/);
  });

  it("keeps essential mobile actions visible and moves secondary actions to overflow", () => {
    assert.match(chromeSource, /editor\.actions\.saveDraft/);
    assert.match(chromeSource, /editor\.actions\.publish/);
    assert.match(chromeSource, /editor\.actions\.more/);
    assert.doesNotMatch(chromeSource, /hidden sm:inline-flex/);
  });

  it("uses a quiet non-shifting settings selection treatment", () => {
    assert.doesNotMatch(settingsSource, /border-l-2 border-transparent/);
    assert.doesNotMatch(settingsSource, /ring-offset-2 ring-offset-background/);
    assert.match(settingsSource, /bg-primary\/\[0\.055\] ring-1 ring-primary\/25/);
  });
});
