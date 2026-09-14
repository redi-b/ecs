import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { PlatformOnboardingState, PlatformTenant } from "@ecs/contracts";

import { getOnboardingExit, resolveShopDestination } from "./shop-selection.js";

const shop = (id: string, status: PlatformTenant["status"] = "active"): PlatformTenant => ({
  createdAt: "2026-09-01T00:00:00.000Z",
  handle: id,
  id,
  name: `Shop ${id}`,
  primaryDomain: { hostname: `${id}.lvh.me` },
  role: "owner",
  status,
  updatedAt: "2026-09-01T00:00:00.000Z",
});

const state = (tenants: PlatformTenant[]): PlatformOnboardingState => ({
  latestProvisioningAttempt: null,
  primaryTenant: null,
  tenants,
  user: { email: "merchant@example.com", id: "user_1", name: "Merchant" },
});

describe("shop destination", () => {
  it("does not redirect onboarding back to itself for an unfinished shop", () => {
    const destination = resolveShopDestination({
      protocol: "https",
      state: state([shop("unfinished", "draft")]),
    });
    assert.equal(getOnboardingExit(destination), null);
    assert.equal(getOnboardingExit({ kind: "picker", href: "/admin/shops" }), "/admin/shops");
  });
  it("sends accounts without an available shop to onboarding", () => {
    assert.deepEqual(resolveShopDestination({ protocol: "https", state: state([]) }), {
      href: "/admin/onboarding",
      kind: "onboarding",
    });
    assert.equal(
      resolveShopDestination({ protocol: "https", state: state([shop("closed", "suspended")]) })
        .kind,
      "onboarding",
    );
  });

  it("opens the only available shop directly", () => {
    assert.deepEqual(resolveShopDestination({ protocol: "https", state: state([shop("one")]) }), {
      href: "https://one.lvh.me/admin",
      kind: "shop",
      tenantId: "one",
    });
  });

  it("uses a valid remembered shop and ignores stale preferences", () => {
    const shops = state([shop("one"), shop("two")]);
    assert.equal(
      resolveShopDestination({ lastShopId: "two", protocol: "http", state: shops }).href,
      "http://two.lvh.me/admin",
    );
    assert.deepEqual(
      resolveShopDestination({ lastShopId: "missing", protocol: "http", state: shops }),
      { href: "/admin/shops", kind: "picker" },
    );
  });
});
