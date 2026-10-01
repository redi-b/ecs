import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

test("account access uses explicit modes with secure native form fallbacks", async () => {
  const source = await readFile(
    new URL("../templates/luvia/v1/pages/Account.astro", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(source, /<details\b/i);
  assert.match(source, /role="tablist"/);
  assert.match(source, /action="\/actions\/account\/login" method="post"/);
  assert.match(source, /action="\/actions\/account\/register" method="post"/);
  assert.match(source, /data-password-toggle/);
});

test("account mobile grid overrides follow desktop definitions so the cascade cannot restore two columns", async () => {
  const css = await readFile(
    new URL("../templates/luvia/v1/styles/pages/account.scss", import.meta.url),
    "utf8",
  );
  const desktop = css.indexOf("grid-template-columns: 1.25fr .75fr");
  assert.ok(desktop >= 0);
  const mobile = css.slice(desktop);
  assert.match(
    mobile,
    /@media\s*\(max-width:\s*760px\)[\s\S]*?\.account\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)/,
  );
});
