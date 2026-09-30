import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { getMerchantExpenses } from "./platform-api/expenses";

const sourceRoot = join(process.cwd(), "src");

test("expenses use a canonical operations workspace and never an Insights child route", () => {
  const page = join(sourceRoot, "app/dashboard/(dashboard)/expenses/page.tsx");

  assert.equal(existsSync(page), true);
  assert.equal(
    existsSync(join(sourceRoot, "app/dashboard/(dashboard)/insights/expenses/page.tsx")),
    false,
  );

  const source = readFileSync(page, "utf8");
  assert.match(source, /ExpensesTable/);
  assert.doesNotMatch(source, /type-eyebrow|estimatedProfit/);
});

test("expense facade forwards server-owned search and filters", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  globalThis.fetch = async (input) => {
    requestedUrl = String(input);
    return Response.json({ count: 0, expenses: [], limit: 20, offset: 20, totalAmount: 0 });
  };

  try {
    const result = await getMerchantExpenses({
      category: "delivery_transport",
      from: "2026-09-01",
      limit: 20,
      offset: 20,
      platformApiBaseUrl: "https://platform.example.test",
      q: "Meskel",
      status: "active",
      to: "2026-09-30",
    });
    assert.equal(result.ok, true);
  } finally {
    globalThis.fetch = originalFetch;
  }

  const url = new URL(requestedUrl);
  assert.equal(url.pathname, "/platform/merchant/expenses");
  assert.equal(url.searchParams.get("q"), "Meskel");
  assert.equal(url.searchParams.get("category"), "delivery_transport");
  assert.equal(url.searchParams.get("status"), "active");
  assert.equal(url.searchParams.get("from"), "2026-09-01");
  assert.equal(url.searchParams.get("to"), "2026-09-30");
});

test("documents have one canonical searchable operations workspace", () => {
  const page = join(sourceRoot, "app/dashboard/(dashboard)/documents/page.tsx");
  assert.equal(existsSync(page), true);

  const source = readFileSync(page, "utf8");
  assert.match(source, /DocumentsTable/);
  assert.doesNotMatch(source, /Issue|Create document/);

  const navigation = readFileSync(join(sourceRoot, "lib/navigation.ts"), "utf8");
  assert.match(navigation, /id: "operations"/);
  assert.match(navigation, /dashboardRoutes\.documents/);
  assert.match(navigation, /dashboardRoutes\.expenses/);
});
