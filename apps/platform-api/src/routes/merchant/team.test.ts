import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createPlatformApp } from "../../app.js";
import { builtInMerchantRolePermissions } from "../../context/merchant-permissions.js";
import type { TenantResolutionResult } from "../../context/tenant-resolver.js";
import type { PlatformAppOptions } from "../../types/platform-app.js";

const emptyTeam = {
  invitations: [],
  members: [],
  roles: [],
};

function teamApp(input?: {
  authorize?: NonNullable<PlatformAppOptions["authorizeDashboardForTenant"]>;
  createRole?: (input: unknown) => Promise<unknown>;
  emailDeliveryConfigured?: boolean;
}) {
  const resolution: TenantResolutionResult = {
    context: {
      domainId: "domain_1",
      hostname: "shop.example.com",
      primaryHostname: "shop.example.com",
      medusaPublishableKeyId: "pk_1",
      medusaRegionId: "region_1",
      medusaSalesChannelId: "channel_1",
      medusaShippingOptionId: "so_1",
      medusaShippingProfileId: "shp_1",
      medusaStockLocationId: "stock_1",
      medusaStoreId: "store_1",
      publishedRevisionId: null,
      status: "active",
      templateId: null,
      templateKey: null,
      templateVersion: null,
      tenantHandle: "shop",
      tenantId: "00000000-0000-0000-0000-000000000001",
      tenantName: "Shop",
    },
    ok: true,
  };
  const merchantTeamService = {
    createRole: input?.createRole ?? (async () => ({ ok: true, data: {} })),
    getOverview: async () => ({ ok: true as const, team: emptyTeam }),
  } as unknown as NonNullable<PlatformAppOptions["merchantTeamService"]>;

  return createPlatformApp({
    dashboardPublicBaseUrl: "https://app.example.com",
    ...(input?.emailDeliveryConfigured === undefined
      ? {}
      : { emailDeliveryConfigured: input.emailDeliveryConfigured }),
    authorizeDashboardForTenant:
      input?.authorize ??
      (async () => ({
        actor: { email: "owner@example.com", id: "user_1", name: "Owner", role: "owner" },
        ok: true as const,
      })),
    getSession: async () => ({
      session: { createdAt: new Date() },
      user: { email: "owner@example.com", id: "user_1", name: "Owner" },
    }),
    merchantTeamService,
    medusaInternalUrl: "http://medusa:9000",
    platformPublicBaseUrl: "http://api.example.com",
    resolveTenantForHost: async () => resolution,
    serviceName: "platform-api",
  });
}

describe("merchant team routes", () => {
  it("returns the team with capabilities derived from authorization", async () => {
    const app = teamApp({
      authorize: async ({ permission }) => ({
        actor: { email: "manager@example.com", id: "user_1", name: "Manager", role: "manager" },
        ok: permission?.team?.includes("roles") !== true,
      }),
    });
    const response = await app.request("http://shop.example.com/platform/merchant/team");
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      capabilities: {
        canInvite: true,
        canManage: true,
        canManageRoles: false,
        emailDeliveryAvailable: false,
      },
      builtInRoles: Object.entries(builtInMerchantRolePermissions).map(([role, permission]) => ({
        permission,
        role,
      })),
      currentUserId: "user_1",
      invitationAcceptBaseUrl: "https://app.example.com",
      invitationTenantId: "00000000-0000-0000-0000-000000000001",
      ok: true,
      team: emptyTeam,
    });
  });

  it("reports whether invitation email delivery is configured", async () => {
    const app = teamApp({ emailDeliveryConfigured: true });
    const response = await app.request("http://shop.example.com/platform/merchant/team");
    assert.equal(response.status, 200);
    const result = (await response.json()) as {
      capabilities: { emailDeliveryAvailable: boolean };
    };
    assert.equal(result.capabilities.emailDeliveryAvailable, true);
  });

  it("rejects identity-administration permissions in custom roles", async () => {
    let called = false;
    const app = teamApp({
      createRole: async () => {
        called = true;
        return { ok: true, data: {} };
      },
    });
    const response = await app.request("http://shop.example.com/platform/merchant/team/roles", {
      body: JSON.stringify({ permission: { member: ["delete"] }, role: "catalog-editor" }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    assert.equal(response.status, 400);
    assert.equal(called, false);
  });

  it("rejects ownership assignment without ownership authority", async () => {
    const app = teamApp({
      authorize: async ({ permission }) => ({
        actor: { email: "manager@example.com", id: "user_1", name: "Manager", role: "manager" },
        ok: permission?.ownership?.includes("transfer") !== true,
      }),
    });
    const response = await app.request(
      "http://shop.example.com/platform/merchant/team/invitations",
      {
        body: JSON.stringify({ email: "new@example.com", role: "owner" }),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    );
    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { error: "owner_role_forbidden" });
  });
});
