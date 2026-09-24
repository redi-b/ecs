import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const sourceRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

// These surfaces intentionally clip their contents and currently have no nested
// Popover/SearchableCombobox. Move clipping to an inner wrapper before adding one.
const clippedSurfaces = new Map([
  ["components/app/command-center.tsx", "Command results; tooltips portal to body"],
  ["components/ui/command.tsx", "Command-only dialog"],
  ["components/storefront/storefront-template-preview.tsx", "Embedded preview"],
  ["features/customers/customer-form-dialog.tsx", "Plain input fields"],
  ["features/insights/product-variants-panel.tsx", "Read-only variants"],
  ["features/products/product-import-dry-run-dialog.tsx", "Import results"],
  ["features/products/product-catalog-picker-dialog.tsx", "Inline product list"],
  ["features/media/media-upload-composer.tsx", "Upload previews"],
  ["features/orders/refund-order-dialog.tsx", "Select menus portal to body"],
  ["features/settings/account-security-panel.tsx", "Inline avatar controls"],
  ["features/billing/billing-workspace.tsx", "Transfer payment evidence dialog; no combobox/popovers"],
]);

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : path.endsWith(".tsx") ? [path] : [];
  });
}

test("modal portal roots do not clip floating controls", () => {
  const violations: string[] = [];
  for (const path of sourceFiles(sourceRoot)) {
    const file = ts.createSourceFile(
      path,
      readFileSync(path, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const name = relative(sourceRoot, path);
    function visit(node: ts.Node) {
      if (
        (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
        /^(DialogContent|SheetContent)$/.test(node.tagName.getText(file))
      ) {
        const attribute = node.attributes.properties.find(
          (prop) => ts.isJsxAttribute(prop) && prop.name.getText(file) === "className",
        );
        if (
          attribute &&
          /\boverflow(?:-[xy])?-(hidden|clip|auto|scroll)\b/.test(attribute.getText(file)) &&
          !clippedSurfaces.has(name)
        ) {
          violations.push(`${name}: move overflow clipping/scrolling inside the modal portal root`);
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(file);
  }
  assert.deepEqual(violations, []);
});
