import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";

test("the product presentation hook uses a source-resolvable local import", async () => {
  const source = await readFile(
    resolve(process.cwd(), "src/workflows/hooks/product-option-value-presentations.ts"),
    "utf8",
  );

  assert.match(source, /from "\.\.\/\.\.\/lib\/product-option-value-presentations";/);
  assert.doesNotMatch(source, /product-option-value-presentations\.js/);
});

test("the discovered hook chain stays runtime-neutral", async () => {
  const helper = await readFile(
    resolve(process.cwd(), "src/lib/product-option-value-presentations.ts"),
    "utf8",
  );
  const middleware = await readFile(resolve(process.cwd(), "src/api/middlewares.ts"), "utf8");

  assert.doesNotMatch(helper, /from "@ecs\//);
  assert.match(helper, /from "\.\/product-option-value-presentation-contract"/);
  assert.match(middleware, /from "\.\.\/lib\/product-option-value-presentation-contract"/);
});
