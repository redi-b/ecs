import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const root = new URL("../../", import.meta.url);

describe("dashboard demo runtime boundaries", () => {
  it("passes only serializable product-detail route data across the server boundary", async () => {
    const source = await readFile(
      new URL("features/demo/dashboard-demo-sections.tsx", root),
      "utf8",
    );

    assert.match(source, /productDetailHrefBase="\/demo\/products"/);
    assert.doesNotMatch(source, /productDetailHref=\{/);
  });

  it("provides tooltip context for the production sidebar used by the demo", async () => {
    const source = await readFile(new URL("dashboard-demo-shell.tsx", import.meta.url), "utf8");
    assert.match(source, /<TooltipProvider>/);
    assert.match(source, /<SidebarProvider>/);
    assert.match(source, /<AppSidebar access=\{dashboardDemoFixture\} demoMode \/>/);
    assert.match(source, /<AppHeader demoMode \/>/);
    assert.match(source, /<DemoPreviewBanner \/>/);
    assert.doesNotMatch(source, /<Sidebar collapsible=/);
  });

  it("composes preview pages from production page and table components", async () => {
    const overview = await readFile(new URL("app/demo/page.tsx", root), "utf8");
    const sections = await readFile(
      new URL("features/demo/dashboard-demo-sections.tsx", root),
      "utf8",
    );
    assert.match(overview, /<PageShell/);
    assert.match(overview, /<MerchantOverview demoMode/);
    assert.match(sections, /<ProductsTable/);
    assert.match(sections, /<OrdersTable/);
    assert.match(sections, /<InsightsWorkspace/);
  });

  it("keeps not-found recovery inside the public preview", async () => {
    const source = await readFile(new URL("app/demo/not-found.tsx", root), "utf8");
    assert.match(source, /actionHref="\/demo"/);
    assert.doesNotMatch(source, /actionHref="\/admin"/);
  });

  it("uses Next Script for the pre-paint theme bootstrap", async () => {
    const source = await readFile(new URL("app/layout.tsx", root), "utf8");
    assert.match(source, /strategy="beforeInteractive"/);
    assert.doesNotMatch(source, /<script\s/);
  });
});
