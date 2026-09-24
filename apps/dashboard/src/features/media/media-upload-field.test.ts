import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

test("product uploads join the selection and keep the populated picker bounded", async () => {
  const source = await readFile(new URL("./media-upload-field.tsx", import.meta.url), "utf8");

  assert.match(source, /addUrls\(\[publicUrl\]\)/);
  assert.match(source, /hasImages \? t\("media\.addMore"\)/);
  assert.match(source, /min-w-0 max-w-full overflow-auto/);
  assert.match(source, /repeat\(auto-fill,minmax\(min\(7\.5rem,100%\),10rem\)\)/);
  assert.match(source, /modifiers=\{\[keepDragInsideGallery\]\}/);
  assert.match(source, /data-media-upload-scope/);
  assert.match(source, /data-testid="media-constraints-badge"/);
  assert.match(source, /formatConstraintsBadge/);
});
