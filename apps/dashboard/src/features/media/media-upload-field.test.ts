import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

test("product uploads join the selection and keep the populated picker compact", async () => {
  const source = await readFile(new URL("./media-upload-field.tsx", import.meta.url), "utf8");

  assert.match(source, /addUrls\(\[publicUrl\]\)/);
  assert.match(source, /hasImages \? t\("media\.addMore"\)/);
  assert.match(source, /overflow-x-hidden/);
  assert.match(source, /repeat\(auto-fill,minmax\(7\.5rem,10rem\)\)/);
});
