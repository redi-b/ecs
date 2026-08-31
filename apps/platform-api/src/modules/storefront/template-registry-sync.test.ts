import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("./template-registry-sync.ts", import.meta.url), "utf8");

test("registry sync resolves conflicts through immutable template identities", () => {
  assert.match(source, /target:\s*storefrontTemplateRows\.id/);
  assert.match(source, /target:\s*storefrontTemplateVersions\.id/);
  assert.doesNotMatch(source, /target:\s*storefrontTemplateRows\.slug/);
  assert.doesNotMatch(source, /target:\s*storefrontTemplateVersions\.templateKey/);
});
