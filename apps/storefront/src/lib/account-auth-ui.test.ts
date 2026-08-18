import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

test("account access uses explicit modes with secure native form fallbacks", async () => {
  const source = await readFile(
    new URL("../templates/luvia/v1/Account.astro", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(source, /<details\b/i);
  assert.match(source, /role="tablist"/);
  assert.match(source, /action="\/actions\/account\/login" method="post"/);
  assert.match(source, /action="\/actions\/account\/register" method="post"/);
  assert.match(source, /data-password-toggle/);
});
