import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const signInFormPath = new URL("../components/app/sign-in-form.tsx", import.meta.url);

test("sign-in form has a secure native POST fallback", async () => {
  const source = await readFile(signInFormPath, "utf8");
  const openingForm = source.match(/<form\b[\s\S]*?>/)?.[0] ?? "";

  assert.match(openingForm, /action="\/admin\/session"/);
  assert.match(openingForm, /method="post"/);
  assert.doesNotMatch(openingForm, /method="get"/i);
});
