import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { templateScopeFromId } from "./template-css-scope";

/**
 * Two invariants that make cross-template CSS bleeding impossible, and that
 * both regressed at least once in practice:
 *
 *  1. Every `var(--token)` a template reads is declared by that template. A
 *     reference to an undeclared custom property invalidates the whole
 *     declaration at computed-value time, silently dropping the style.
 *  2. Every rule a template ships is prefixed with its `.template-<name>`
 *     scope, so two templates can reuse the same class names safely.
 *
 * The scoper's own unit tests exercise synthetic CSS strings; these run
 * against the real files, which is where both bugs actually lived.
 */

const TEMPLATES_DIR = join(import.meta.dirname, "..", "..", "templates");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(scss|astro)$/.test(entry)) out.push(full);
  }
  return out;
}

const TEMPLATES = ["luvia", "nexahub", "afro"];

for (const template of TEMPLATES) {
  const root = join(TEMPLATES_DIR, template, "v1");
  const files = walk(root);

  test(`${template}: every referenced custom property is declared`, () => {
    const declared = new Set<string>();
    const referenced = new Map<string, string>();

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const [, name] of source.matchAll(/(--[a-z0-9-]+)\s*:/g)) declared.add(name);
      for (const [, name] of source.matchAll(/var\(\s*(--[a-z0-9-]+)/g)) {
        if (!referenced.has(name)) referenced.set(name, file);
      }
    }

    // Fallback values make an undeclared token legal: var(--x, red) is valid.
    const withFallback = new Set<string>();
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const [, name] of source.matchAll(/var\(\s*(--[a-z0-9-]+)\s*,/g)) withFallback.add(name);
    }

    const missing = [...referenced]
      .filter(([name]) => !declared.has(name) && !withFallback.has(name))
      .map(([name, file]) => `  ${name} referenced in ${file.replace(TEMPLATES_DIR, "")}`);

    assert.deepEqual(
      missing,
      [],
      `${template} reads undeclared custom properties:\n${missing.join("\n")}`,
    );
  });

  test(`${template}: every stylesheet is reachable by the scoper`, () => {
    // The scoper decides scope from the file path alone, so a stylesheet whose
    // path it cannot resolve is emitted completely global and can collide with
    // every other template. This is the only way cross-template bleed happens.
    const unreachable = files
      .filter((file) => file.endsWith(".scss"))
      .filter((file) => templateScopeFromId(file) === null)
      .map((file) => `  ${file.replace(TEMPLATES_DIR, "")}`);

    assert.deepEqual(
      unreachable,
      [],
      `${template} has stylesheets the scoper cannot scope (they would apply to every template):\n${unreachable.join("\n")}`,
    );
  });
}

test("templateScopeFromId ignores stylesheets outside src/templates", () => {
  // Shared, non-template CSS gets no scope — that is the escape hatch the
  // warnings in the plugin exist to surface, so assert the behaviour is known.
  assert.equal(templateScopeFromId("/repo/apps/storefront/src/styles/shared.scss"), null);
  assert.equal(
    templateScopeFromId("/repo/apps/storefront/src/templates/luvia/v1/styles/main.scss"),
    "luvia",
  );
});
