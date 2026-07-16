import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { decryptSecret, encryptSecret, isEncryptedSecret, secretFingerprint } from "./secret-box.js";

describe("secret-box", () => {
  it("round-trips secrets with AES-GCM", () => {
    const key = "test-payments-encryption-key";
    const plain = "CHASECK_TEST_abc123xyz";
    const enc = encryptSecret(plain, key);
    assert.equal(isEncryptedSecret(enc), true);
    assert.equal(decryptSecret(enc, key), plain);
  });

  it("still reads legacy plaintext until re-encrypted", () => {
    assert.equal(decryptSecret("plain-secret", "any"), "plain-secret");
  });

  it("fingerprints last 4", () => {
    assert.equal(secretFingerprint("CHASECK_TEST_9999"), "9999");
  });
});
