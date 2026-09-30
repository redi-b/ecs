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
  assert.match(source, /DocumentsCreateMenu/);

  const table = readFileSync(join(sourceRoot, "features/documents/documents-table.tsx"), "utf8");
  assert.match(table, /RowActionsMenu/);
  assert.match(table, /listEntityLinkClassName/);

  const createMenu = readFileSync(
    join(sourceRoot, "features/documents/documents-create-menu.tsx"),
    "utf8",
  );
  assert.match(createMenu, /dashboardRoutes\.orders/);
  assert.match(createMenu, /view=drafts/);

  const navigation = readFileSync(join(sourceRoot, "lib/navigation.ts"), "utf8");
  assert.match(navigation, /id: "operations"/);
  assert.match(navigation, /dashboardRoutes\.documents/);
  assert.match(navigation, /dashboardRoutes\.expenses/);
});

test("POS is a dedicated selling mode over existing commerce seams", () => {
  const page = join(sourceRoot, "app/dashboard/(pos)/pos/page.tsx");
  assert.equal(existsSync(page), true);
  assert.match(readFileSync(page, "utf8"), /QuickSaleWorkspace/);
  assert.equal(existsSync(join(sourceRoot, "app/dashboard/(quick-sale)")), false);
  assert.equal(existsSync(join(sourceRoot, "app/dashboard/quick-sale")), false);

  const shellLayout = readFileSync(
    join(sourceRoot, "app/dashboard/(dashboard)/layout.tsx"),
    "utf8",
  );
  assert.doesNotMatch(shellLayout, /data-pos-mode|currentPathname/);
  const sellingLayout = readFileSync(join(sourceRoot, "app/dashboard/(pos)/layout.tsx"), "utf8");
  assert.match(sellingLayout, /data-pos-mode/);
  assert.equal(
    existsSync(join(sourceRoot, "app/dashboard/(dashboard)/quick-sale/page.tsx")),
    false,
  );

  const workspace = readFileSync(
    join(sourceRoot, "features/quick-sale/quick-sale-workspace.tsx"),
    "utf8",
  );
  assert.match(workspace, /QuickSaleCatalog/);
  assert.match(workspace, /QuickSaleCart/);
  assert.doesNotMatch(workspace, /ProductCatalogPickerDialog/);
  assert.match(workspace, /channel:\s*"pos"/);
  assert.match(workspace, /pay_later/);
  assert.match(workspace, /useState\(initialDrafts\)/);
  assert.match(workspace, /setSavedSales/);
  assert.match(workspace, /await archiveSavedSale/);
  assert.match(workspace, /response\?\.status === 404/);
  assert.match(workspace, /refreshCatalog/);
  assert.match(workspace, /useAccess/);
  assert.match(workspace, /tenant\?\.name/);
  assert.match(workspace, /quickSale\.operatorLine/);
  assert.doesNotMatch(workspace, /chapa/i);

  const catalog = readFileSync(
    join(sourceRoot, "features/quick-sale/quick-sale-catalog.tsx"),
    "utf8",
  );
  assert.match(catalog, /category\.mediaUrl/);
  assert.match(catalog, /onPointerDown/);
  assert.match(catalog, /touch-pan-x/);
  assert.match(catalog, /overscroll-x-contain/);

  const cart = readFileSync(join(sourceRoot, "features/quick-sale/quick-sale-cart.tsx"), "utf8");
  assert.match(cart, /InputGroupText/);
  assert.match(cart, /reasonRequired/);
  assert.match(cart, /reasonTouched/);
  assert.match(cart, /FieldDescription/);
  assert.doesNotMatch(cart, /mb-3 text-xs text-destructive/);

  const productListAction = readFileSync(
    join(sourceRoot, "app/dashboard/products/actions/list/route.ts"),
    "utf8",
  );
  assert.match(productListAction, /searchParams\.get\("q"\)/);
  assert.match(productListAction, /searchParams\.get\("categoryId"\)/);

  const navigation = readFileSync(join(sourceRoot, "lib/navigation.ts"), "utf8");
  assert.doesNotMatch(navigation, /id: "quick-sale"/);
  assert.ok(navigation.indexOf('{ id: "storefront"') < navigation.indexOf('{ id: "operations"'));

  const sidebar = readFileSync(join(sourceRoot, "components/app/app-sidebar.tsx"), "utf8");
  assert.doesNotMatch(sidebar, /dashboardRoutes\.quickSale/);

  const header = readFileSync(join(sourceRoot, "components/app/app-header.tsx"), "utf8");
  assert.match(header, /dashboardRoutes\.pos/);
  assert.match(header, /AppIcons\.quickSale/);
  assert.doesNotMatch(header, /PosRegisterIcon/);
  assert.match(header, /nav\.quickSale/);
  assert.doesNotMatch(header, /nav\.newSale/);
  assert.match(header, /TooltipContent/);
  assert.doesNotMatch(header, /hidden md:inline-flex/);
  assert.doesNotMatch(header, /className="text-primary hover:bg-primary/);

  const commandRegistry = readFileSync(join(sourceRoot, "lib/command-registry.ts"), "utf8");
  assert.match(commandRegistry, /"quick sale"/);

  const enNav = readFileSync(join(sourceRoot, "i18n/messages/en/nav.json"), "utf8");
  const enQuickSale = readFileSync(join(sourceRoot, "i18n/messages/en/quickSale.json"), "utf8");
  assert.match(enNav, /"quickSale": "POS"/);
  assert.match(enQuickSale, /"title": "POS"/);
  assert.doesNotMatch(enQuickSale, /Quick sale/);

  const icons = readFileSync(join(sourceRoot, "components/app/icons.ts"), "utf8");
  assert.match(icons, /quickSale: CashierMachineIcon/);
  assert.doesNotMatch(icons, /quickSale: RiShoppingBasket2Line/);
  const cashierIcon = readFileSync(
    join(sourceRoot, "components/app/cashier-machine-icon.tsx"),
    "utf8",
  );
  assert.match(cashierIcon, /data-slot="cashier-currency-cue"/);
  assert.match(cashierIcon, /data-slot="cashier-currency-cue"[\s\S]*fill="currentColor"/);
  assert.doesNotMatch(cashierIcon, /data-slot="cashier-currency-cue"[\s\S]*strokeLinecap/);

  assert.match(workspace, /catalogError/);
  assert.match(workspace, /categoriesLoading/);
  assert.match(workspace, /categoriesError/);
  assert.match(catalog, /onRetryProducts/);
  assert.match(catalog, /onRetryCategories/);
  assert.match(catalog, /quickSale\.productsLoadFailed/);
  assert.match(catalog, /quickSale\.noCategories/);

  const categoryDragStart = catalog.match(
    /function startCategoryDrag[\s\S]*?\n {2}}\n\n {2}function moveCategoryDrag/,
  )?.[0];
  assert.ok(categoryDragStart);
  assert.doesNotMatch(categoryDragStart, /setPointerCapture/);
  assert.match(catalog, /if \(Math\.abs\(distance\) > 4 && !drag\.moved\)[\s\S]*setPointerCapture/);

  assert.match(workspace, /useTransition/);
  assert.match(workspace, /startExit\(\(\) => router\.push\(dashboardRoutes\.overview\)\)/);
  assert.match(workspace, /aria-busy=\{exiting/);
  assert.match(workspace, /exiting \? <AppIcons\.loader/);

  const action = readFileSync(join(sourceRoot, "app/dashboard/pos/actions/route.ts"), "utf8");
  assert.match(action, /manual-orders/);
  assert.match(action, /mark-paid/);
  assert.match(action, /status:\s*202/);
});
