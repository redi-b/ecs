import assert from "node:assert/strict";
import test from "node:test";

import { createMediaUploadId } from "./media-upload-id";

test("creates an upload id when crypto.randomUUID is unavailable", () => {
  const id = createMediaUploadId({ getRandomValues: undefined, randomUUID: undefined });

  assert.match(id, /^upload-[a-z0-9]+-[a-z0-9]+$/);
});

test("uses randomUUID when the runtime provides it", () => {
  assert.equal(createMediaUploadId({ randomUUID: () => "stable-uuid" }), "stable-uuid");
});
