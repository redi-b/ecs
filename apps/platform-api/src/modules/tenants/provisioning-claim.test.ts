import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  runWithTenantProvisioningClaim,
  type TenantProvisioningClaimStore,
} from "./provisioning-claim.js";

describe("runWithTenantProvisioningClaim", () => {
  it("does not run provisioning when another request owns the handle", async () => {
    let operationCalls = 0;
    const store: TenantProvisioningClaimStore = {
      acquire: async () => null,
      release: async () => {
        throw new Error("an unowned claim must not be released");
      },
    };

    const result = await runWithTenantProvisioningClaim(
      store,
      {
        handle: "bole-style",
        ownerUserId: "user_1",
        preferredPlatformTenantId: "tenant_new",
      },
      async () => {
        operationCalls += 1;
        return "created";
      },
    );

    assert.deepEqual(result, { acquired: false });
    assert.equal(operationCalls, 0);
  });

  it("uses the claimed tenant identity and releases after success", async () => {
    const releases: unknown[] = [];
    const store: TenantProvisioningClaimStore = {
      acquire: async () => ({
        claimToken: "claim_1",
        platformTenantId: "tenant_stable",
      }),
      release: async (input) => {
        releases.push(input);
      },
    };

    const result = await runWithTenantProvisioningClaim(
      store,
      {
        handle: "bole-style",
        ownerUserId: "user_1",
        preferredPlatformTenantId: "tenant_new",
      },
      async (platformTenantId) => ({ platformTenantId }),
    );

    assert.deepEqual(result, {
      acquired: true,
      value: { platformTenantId: "tenant_stable" },
    });
    assert.deepEqual(releases, [{ claimToken: "claim_1", handle: "bole-style" }]);
  });

  it("releases the claim when provisioning throws", async () => {
    let released = false;
    const store: TenantProvisioningClaimStore = {
      acquire: async () => ({
        claimToken: "claim_1",
        platformTenantId: "tenant_stable",
      }),
      release: async () => {
        released = true;
      },
    };

    await assert.rejects(
      runWithTenantProvisioningClaim(
        store,
        {
          handle: "bole-style",
          ownerUserId: "user_1",
          preferredPlatformTenantId: "tenant_new",
        },
        async () => {
          throw new Error("provisioning failed");
        },
      ),
      /provisioning failed/,
    );
    assert.equal(released, true);
  });
});
