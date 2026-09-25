import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, describe, it } from "node:test";

import { createPlatformDb, tenantProvisioningClaims } from "@ecs/db";
import { eq, inArray } from "drizzle-orm";

import { createTenantProvisioningClaimStore } from "./provisioning-claim.js";

const connectionString = process.env.PLATFORM_AUTH_INTEGRATION_DATABASE_URL;

describe("tenant provisioning claims with PostgreSQL", { skip: !connectionString }, () => {
  const database = createPlatformDb({ connectionString: connectionString ?? "" });
  const raceHandle = `claim-race-${randomUUID().slice(0, 8)}`;
  const takeoverHandle = `claim-takeover-${randomUUID().slice(0, 8)}`;

  after(async () => {
    await database.db
      .delete(tenantProvisioningClaims)
      .where(inArray(tenantProvisioningClaims.handle, [raceHandle, takeoverHandle]));
    await database.pool.end();
  });

  it("allows only one process to claim a handle", async () => {
    const store = createTenantProvisioningClaimStore(database.db);
    const [first, second] = await Promise.all([
      store.acquire({
        handle: raceHandle,
        ownerUserId: "user_1",
        preferredPlatformTenantId: randomUUID(),
      }),
      store.acquire({
        handle: raceHandle,
        ownerUserId: "user_1",
        preferredPlatformTenantId: randomUUID(),
      }),
    ]);

    assert.equal([first, second].filter(Boolean).length, 1);
  });

  it("takes over an expired lease without changing the tenant identity", async () => {
    const originalTenantId = randomUUID();
    const initialStore = createTenantProvisioningClaimStore(database.db);
    const initial = await initialStore.acquire({
      handle: takeoverHandle,
      ownerUserId: "user_1",
      preferredPlatformTenantId: originalTenantId,
    });
    assert.ok(initial);

    await database.db
      .update(tenantProvisioningClaims)
      .set({ leaseExpiresAt: new Date(Date.now() - 1_000) })
      .where(eq(tenantProvisioningClaims.handle, takeoverHandle));

    const takeoverStore = createTenantProvisioningClaimStore(database.db);
    const takeover = await takeoverStore.acquire({
      handle: takeoverHandle,
      ownerUserId: "user_1",
      preferredPlatformTenantId: randomUUID(),
    });

    assert.ok(takeover);
    assert.equal(takeover.platformTenantId, originalTenantId);
    assert.notEqual(takeover.claimToken, initial.claimToken);
  });
});
