import assert from "node:assert/strict";
import { test } from "node:test";

import { createEmailDeliveryIdempotencyKey } from "./delivery-service.js";

test("email delivery idempotency keys are stable and do not expose action URLs", () => {
  const input = {
    idempotencySource: "https://app.example.com/verify?token=top-secret",
    recipient: "LIYA@example.com",
    templateKey: "account.email_verification",
  };
  const first = createEmailDeliveryIdempotencyKey(input);
  const second = createEmailDeliveryIdempotencyKey({ ...input, recipient: "liya@example.com" });
  assert.equal(first, second);
  assert.equal(first.length, 64);
  assert.doesNotMatch(first, /top-secret/);
});
