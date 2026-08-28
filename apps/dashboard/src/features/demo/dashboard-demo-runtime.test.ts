import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const root = new URL("../../", import.meta.url);

describe("dashboard demo runtime boundaries", () => {
  it("provides tooltip context for the production sidebar used by the demo", async () => {
    const source = await readFile(new URL("dashboard-demo-shell.tsx", import.meta.url), "utf8");
    assert.match(source, /<TooltipProvider>/);
    assert.match(source, /<SidebarProvider>/);
  });

  it("uses Next Script for the pre-paint theme bootstrap", async () => {
    const source = await readFile(new URL("app/layout.tsx", root), "utf8");
    assert.match(source, /strategy="beforeInteractive"/);
    assert.doesNotMatch(source, /<script\s/);
  });
});
