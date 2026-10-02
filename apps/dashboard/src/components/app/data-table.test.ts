import assert from "node:assert/strict";
import { test } from "node:test";

import { isRowInteractiveTarget, shouldNavigateFromRowClick } from "./data-table";

function click(overrides: Partial<MouseEvent> = {}) {
  return {
    button: 0,
    defaultPrevented: false,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    target: null,
    ...overrides,
  } as never;
}

test("table rows navigate from a plain primary click", () => {
  assert.equal(shouldNavigateFromRowClick(click()), true);
});

test("table rows do not hijack modified or non-primary clicks", () => {
  assert.equal(shouldNavigateFromRowClick(click({ ctrlKey: true })), false);
  assert.equal(shouldNavigateFromRowClick(click({ metaKey: true })), false);
  assert.equal(shouldNavigateFromRowClick(click({ button: 1 })), false);
  assert.equal(shouldNavigateFromRowClick(click({ defaultPrevented: true })), false);
});

test("interactive-target guard is safe for empty event targets", () => {
  assert.equal(isRowInteractiveTarget(null), false);
});
