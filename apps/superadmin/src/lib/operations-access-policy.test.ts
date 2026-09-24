import assert from "node:assert/strict";
import test from "node:test";

import { resolveOperationsAccessAction } from "./operations-access-policy";

test("operators can replace an existing non-operator session from the sign-in page", () => {
  assert.equal(resolveOperationsAccessAction("forbidden"), "sign_in");
});

test("a recoverable Platform outage renders an availability state", () => {
  assert.equal(resolveOperationsAccessAction("unavailable"), "show_unavailable");
});

test("wrong hosts remain hidden while unauthenticated operators sign in", () => {
  assert.equal(resolveOperationsAccessAction("wrong_host"), "not_found");
  assert.equal(resolveOperationsAccessAction("unauthenticated"), "sign_in");
});
