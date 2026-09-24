import assert from "node:assert/strict";
import test from "node:test";
import { createClientId } from "./client-id.js";

test("creates a prefixed id when randomUUID is unavailable", () => {
  const id = createClientId("option", { getRandomValues: undefined, randomUUID: undefined });
  assert.match(id, /^option-[a-z0-9]+-[a-z0-9]+$/);
});

test("prefixes a UUID when available", () => {
  assert.equal(createClientId("value", { randomUUID: () => "stable-uuid" }), "value-stable-uuid");
});
