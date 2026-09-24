import assert from "node:assert/strict";
import test from "node:test";

import { createStorefrontPreviewToken, verifyStorefrontPreviewToken } from "./preview-token";

const secret = "test-preview-secret-that-is-at-least-32-bytes";

test("issues and verifies a tenant-scoped preview token", () => {
  const issued = createStorefrontPreviewToken({ now: 1_000, secret, tenantId: "tenant_1", ttlSeconds: 60, userId: "user_1" });
  const payload = verifyStorefrontPreviewToken({ now: 2_000, secret, token: issued.token });
  assert.equal(payload?.tenantId, "tenant_1");
  assert.equal(payload?.userId, "user_1");
  assert.equal(payload?.expiresAt, 61_000);
});

test("rejects expired and tampered preview tokens", () => {
  const issued = createStorefrontPreviewToken({ now: 1_000, secret, tenantId: "tenant_1", ttlSeconds: 1, userId: "user_1" });
  assert.equal(verifyStorefrontPreviewToken({ now: 2_001, secret, token: issued.token }), null);
  assert.equal(verifyStorefrontPreviewToken({ now: 1_500, secret, token: `${issued.token}x` }), null);
});
