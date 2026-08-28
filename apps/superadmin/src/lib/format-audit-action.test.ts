import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatAuditAction } from "./format-audit-action";

describe("formatAuditAction", () => {
  it("uses operator-facing labels for sensitive and recovery activity", () => {
    assert.equal(formatAuditAction("tenant.status_changed"), "Merchant status changed");
    assert.equal(formatAuditAction("support.access_revoked"), "Support access revoked");
    assert.equal(
      formatAuditAction("provisioning.recovery_requested"),
      "Shop setup recovery started",
    );
    assert.equal(formatAuditAction("provisioning.recovery_failed"), "Shop setup recovery failed");
  });

  it("does not expose an unknown machine action", () => {
    assert.equal(formatAuditAction("unknown.internal_action"), "Platform record changed");
  });
});
