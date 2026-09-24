import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const chromeSource = await readFile(new URL("./editor-chrome.tsx", import.meta.url), "utf8");
const settingsSource = await readFile(new URL("./editor-settings.tsx", import.meta.url), "utf8");
const pageSource = await readFile(
  new URL("../../app/dashboard/(dashboard)/editor/page.tsx", import.meta.url),
  "utf8",
);

describe("storefront editor workspace containment", () => {
  it("uses an intentional canvas height instead of locking the dashboard viewport", () => {
    assert.match(chromeSource, /h-\[clamp\(40rem,calc\(100dvh-11rem\),58rem\)\]/);
    assert.match(
      chromeSource,
      /contain-strict flex h-\[clamp\(40rem,calc\(100dvh-11rem\),58rem\)\]/,
    );
    assert.match(chromeSource, /min-h-0 min-w-0 flex-1 overflow-hidden p-3/);
    assert.match(chromeSource, /isFullscreen && "h-auto flex-1"/);
    assert.match(pageSource, /className="flex-none gap-0/);
  });

  it("chains settings scrolling to the outer main scrollbar", () => {
    assert.match(settingsSource, /h-full min-h-0 overflow-y-auto(?! overscroll)/);
    assert.doesNotMatch(settingsSource, /overflow-y-auto overscroll-contain/);
  });

  it("keeps preview and settings aligned while allowing the desktop panel to collapse", () => {
    assert.match(chromeSource, /lg:w-\[clamp\(18rem,20vw,24rem\)\]/);
    assert.match(chromeSource, /lg:w-0 lg:border-l-0 lg:opacity-0/);
    assert.match(chromeSource, /setSettingsOpen\(true\)/);
  });

  it("keeps compact page tabs and falls back to a scalable page select", () => {
    assert.match(chromeSource, /pages\.length <= 3/);
    assert.match(chromeSource, /<Select onValueChange=\{onChange\} value=\{value\}>/);
  });

  it("keeps draft saving visible on mobile and uses compact viewport glyphs", () => {
    assert.doesNotMatch(chromeSource, /className="hidden min-w-0 sm:inline-flex"/);
    assert.match(chromeSource, /<RiComputerLine className="size-4" aria-hidden \/>/);
    assert.match(chromeSource, /<RiSmartphoneLine className="size-4" aria-hidden \/>/);
  });

  it("uses a quiet non-shifting settings selection treatment", () => {
    assert.doesNotMatch(settingsSource, /border-l-2 border-transparent/);
    assert.doesNotMatch(settingsSource, /ring-offset-2 ring-offset-background/);
    assert.match(settingsSource, /bg-primary\/\[0\.07\] ring-2 ring-primary/);
  });
});
