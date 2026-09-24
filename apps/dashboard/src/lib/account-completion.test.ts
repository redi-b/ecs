import assert from "node:assert/strict";
import test from "node:test";

import { getSafeAccountCompletionPath } from "./account-completion.js";

test("account completion preserves supported local destinations", () => {
  assert.equal(getSafeAccountCompletionPath("/onboarding"), "/onboarding");
  assert.equal(
    getSafeAccountCompletionPath("/accept-invitation?invitationId=invite_1"),
    "/accept-invitation?invitationId=invite_1",
  );
  assert.equal(
    getSafeAccountCompletionPath("/dashboard/settings?tab=account"),
    "/dashboard/settings?tab=account",
  );
});

test("account completion rejects external and unrelated destinations", () => {
  assert.equal(getSafeAccountCompletionPath("https://evil.example/path"), "/onboarding");
  assert.equal(getSafeAccountCompletionPath("//evil.example/path"), "/onboarding");
  assert.equal(getSafeAccountCompletionPath("/sign-in"), "/onboarding");
  assert.equal(getSafeAccountCompletionPath(undefined), "/onboarding");
});
