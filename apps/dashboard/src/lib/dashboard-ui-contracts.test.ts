import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const sourceRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = (path: string) => readFileSync(join(sourceRoot, path), "utf8");

test("shared selects keep comfortable form density and expose compact toolbar density", () => {
  const select = source("components/ui/select.tsx");
  assert.match(select, /SelectSizeContext/);
  assert.match(select, /data-size=\{resolvedSize\}/);
  assert.match(select, /scroll-my-1 p-1/);
  assert.match(select, /py-1\.5/);
  assert.match(select, /data-\[size=sm\].*py-1/);
  assert.doesNotMatch(select, /data-\[position=popper\]:h-\(--radix-select-trigger-height\)/);

  const overview = source("features/overview/merchant-overview.tsx");
  assert.match(overview, /<Select\s+size="sm"\s+value=\{rangePreset\}/);
  assert.match(overview, /<Select\s+size="sm"\s+value=\{metric\}/);
});

test("dashboard field triggers use the shared compact control height", () => {
  const datePicker = source("components/ui/date-picker.tsx");
  const dateRangePicker = source("components/ui/date-range-picker.tsx");
  const dateTimePicker = source("components/ui/datetime-picker.tsx");
  const searchableCombobox = source("components/app/searchable-combobox.tsx");
  const onboardingParts = source("components/onboarding/onboarding-form-parts.tsx");
  const catalogPicker = source("features/products/product-catalog-picker-dialog.tsx");
  const editorSettings = source("features/storefront-editor/editor-settings.tsx");

  assert.doesNotMatch(datePicker, /group h-9/);
  assert.doesNotMatch(dateRangePicker, /h-9 w-full/);
  assert.doesNotMatch(dateTimePicker, /group h-9/);
  assert.doesNotMatch(searchableCombobox, /h-9 w-full/);
  assert.doesNotMatch(onboardingParts, /className="h-11"/);
  assert.doesNotMatch(catalogPicker, /h-9 w-full justify-between/);
  assert.doesNotMatch(editorSettings, /h-9 min-w-0 flex-1 justify-between/);
});

test("expense creation keeps shared single-line control geometry", () => {
  const expenseDialog = source("features/expenses/expense-create-dialog.tsx");
  assert.match(expenseDialog, /<SelectTrigger className="w-full"/);
  assert.doesNotMatch(expenseDialog, /SelectTrigger[^>]*rounded-/);
  assert.doesNotMatch(expenseDialog, /<select|type="date"/);
});

test("shared dialog footer exposes semantic action groups without changing its default", () => {
  const dialog = source("components/ui/dialog.tsx");
  assert.match(dialog, /function DialogFooterLeading/);
  assert.match(dialog, /function DialogFooterActions/);
  assert.match(dialog, /sm:justify-end/);

  const catalogPicker = source("features/products/product-catalog-picker-dialog.tsx");
  assert.match(catalogPicker, /<DialogFooterLeading>/);
  assert.match(catalogPicker, /<DialogFooterActions>/);
});

test("product media upload actions distinguish upload from library browsing", () => {
  const upload = source("features/media/media-upload-field.tsx");
  assert.match(upload, /<AppIcons\.upload data-icon="inline-start"/);
  assert.match(upload, /triggerContent=\{hasImages \? <AppIcons\.folder/);
});

test("sidebar storefront dock stays fixed and exposes open and copy actions", () => {
  const sidebar = source("components/app/app-sidebar.tsx");
  const dock = source("components/app/storefront-dock.tsx");
  const layout = source("app/dashboard/(dashboard)/layout.tsx");

  assert.match(sidebar, /storefrontPublished=\{access\.storefront\.isPublished\}/);
  assert.match(sidebar, /pb-2/);
  assert.match(sidebar, /overscroll-contain/);
  assert.match(sidebar, /<\/SidebarContent>[\s\S]{0,120}<StorefrontDock/);
  assert.match(dock, /PopoverContent/);
  assert.match(dock, /storefrontPublished/);
  assert.match(dock, /common\.storefrontDock\.published/);
  assert.match(dock, /common\.storefrontDock\.notPublished/);
  assert.match(dock, /group-data-\[collapsible=icon\]:mx-auto/);
  assert.match(dock, /onPointerEnter=\{openOnHover\}/);
  assert.match(dock, /onPointerLeave=\{closeAfterHover\}/);
  assert.match(dock, /data-storefront-status/);
  assert.match(dock, /data-storefront-status-collapsed/);
  assert.match(dock, /group-data-\[collapsible=icon\]:block/);
  assert.match(dock, /statusLabel/);
  assert.doesNotMatch(dock, /hidden=\{!collapsed\}/);
  assert.match(dock, /copyTextToClipboard/);
  assert.match(dock, /onFocusOutside/);
  assert.match(dock, /isClipboardFallbackTarget/);
  assert.match(dock, /toast\.success/);
  assert.match(dock, /target="_blank"/);
  assert.match(layout, /storefrontUrl=\{storefrontUrl\}/);
});

test("operations tables expose visible row actions and only useful bulk selection", () => {
  const documents = source("features/documents/documents-table.tsx");
  const expenses = source("features/expenses/expenses-table.tsx");

  assert.match(documents, /<RowActionsMenu/);
  assert.doesNotMatch(documents, /id: "select"/);
  assert.match(expenses, /<RowActionsMenu/);
  assert.match(expenses, /id: "select"/);
  assert.match(expenses, /bulkActions=/);
  assert.match(expenses, /bulkVoid/);
});

test("expenses remain unavailable until the operations workspace owns the workflow", () => {
  assert.equal(
    existsSync(join(sourceRoot, "app/dashboard/(dashboard)/insights/expenses/page.tsx")),
    false,
  );
  assert.equal(existsSync(join(sourceRoot, "app/dashboard/insights/expenses/page.tsx")), false);

  const actions = source("features/insights/insights-header-actions.tsx");
  assert.doesNotMatch(actions, /dashboard\/insights\/expenses/);
});

test("simple form dialogs separate exit and forward actions semantically", () => {
  for (const path of [
    "features/catalog-taxonomy/taxonomy-create-dialog.tsx",
    "features/customers/customer-form-dialog.tsx",
    "features/products/bulk-inventory-dialog.tsx",
    "features/products/product-edit-dialog.tsx",
    "features/products/product-import-dry-run-dialog.tsx",
    "features/promotions/promotion-code-batch-dialog.tsx",
    "features/settings/payments-section.tsx",
    "features/settings/account-security-panel.tsx",
    "features/settings/settings-sections.tsx",
    "features/settings/settings-workspace.tsx",
    "features/settings/team-section.tsx",
    "features/settings/telegram-connect-panel.tsx",
    "features/settings/telegram-shop-tools-panel.tsx",
    "features/billing/billing-workspace.tsx",
    "features/orders/mark-paid-dialog.tsx",
    "features/orders/receive-return-dialog.tsx",
    "features/orders/refund-order-dialog.tsx",
    "features/orders/return-order-dialog.tsx",
  ]) {
    const dialog = source(path);
    assert.match(dialog, /DialogFooterLeading/);
    assert.match(dialog, /DialogFooterActions/);
  }
});

test("mobile breadcrumbs preserve ancestor navigation through a collapsed menu", () => {
  const breadcrumbs = source("components/app/app-breadcrumbs.tsx");
  assert.match(breadcrumbs, /BreadcrumbEllipsis/);
  assert.match(breadcrumbs, /DropdownMenu/);
  assert.match(breadcrumbs, /sm:hidden/);
});

test("search sharing reuses the shared media reference control", () => {
  const settings = source("features/settings/storefront-seo-settings-form.tsx");
  assert.match(settings, /MediaImageReferenceControl/);
  assert.doesNotMatch(settings, /uploadMediaFile/);
});

test("waiting order overflow has a separate accessible product summary trigger", () => {
  const waitingOrders = source("features/overview/waiting-orders.tsx");
  assert.match(waitingOrders, /WaitingOrderProducts/);
  assert.match(waitingOrders, /PopoverTrigger/);
});
