import assert from "node:assert/strict";
import { test } from "node:test";

import { isAllowedVerificationPost } from "./verification-request.js";

test("allows a same-origin verification form when proxy origin reconstruction differs", () => {
  assert.equal(
    isAllowedVerificationPost({
      publicOrigin: "https://app.example.com",
      requestOrigin: "http://localhost:3001",
      secFetchSite: "same-origin",
      submittedOrigin: "https://app.example.com:443",
    }),
    true,
  );
});

test("allows an origin match when fetch metadata is unavailable", () => {
  assert.equal(
    isAllowedVerificationPost({
      publicOrigin: "https://app.example.com",
      requestOrigin: "http://localhost:3001",
      secFetchSite: null,
      submittedOrigin: "https://app.example.com",
    }),
    true,
  );
});

test("rejects a cross-site verification form", () => {
  assert.equal(
    isAllowedVerificationPost({
      publicOrigin: "https://app.example.com",
      requestOrigin: "https://app.example.com",
      secFetchSite: "cross-site",
      submittedOrigin: "https://attacker.example",
    }),
    false,
  );
});
