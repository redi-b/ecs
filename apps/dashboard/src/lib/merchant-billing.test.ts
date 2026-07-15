import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getMerchantBillingStatus } from "./merchant-billing.js";

const billingPayload = {
  billing: {
    subscription: {
      id: "sub_1",
      status: "active",
      billingCycle: "monthly",
      manualPaymentState: "paid",
      currentPeriodStart: "2026-07-15T00:00:00.000Z",
      currentPeriodEnd: "2026-08-15T00:00:00.000Z",
    },
    plan: {
      id: "plan_growth",
      name: "Growth",
      price: "2499",
      limits: {},
      features: {},
      isFree: false,
    },
    invoices: [],
    availablePaidPlans: [],
    catalog: [
      {
        id: "plan_starter",
        name: "Starter",
        price: "0",
        isFree: true,
        isCurrent: false,
      },
      {
        id: "plan_growth",
        name: "Growth",
        price: "2499",
        isFree: false,
        isCurrent: true,
      },
    ],
  },
};

describe("getMerchantBillingStatus", () => {
  it("fetches dedicated tenant billing status", async () => {
    let forwardedRequest: Request | undefined;
    const result = await getMerchantBillingStatus({
      cookieHeader: "better-auth.session_token=session_1",
      platformApiBaseUrl: "http://platform.local",
      tenantId: "tenant_1",
      fetcher: async (input, init) => {
        forwardedRequest = new Request(input, init);
        return Response.json(billingPayload);
      },
    });

    assert.equal(result.ok, true);
    assert.equal(
      forwardedRequest?.url,
      "http://platform.local/platform/tenants/tenant_1/billing",
    );
    assert.equal(forwardedRequest?.headers.get("cookie"), "better-auth.session_token=session_1");
    if (result.ok) {
      assert.equal(result.billing.plan?.name, "Growth");
    }
  });

  it("returns an error when platform billing fails", async () => {
    const result = await getMerchantBillingStatus({
      platformApiBaseUrl: "http://platform.local",
      tenantId: "tenant_1",
      fetcher: async () => Response.json({ error: "billing_not_found" }, { status: 404 }),
    });

    assert.deepEqual(result, {
      ok: false,
      status: 404,
      message: "billing_not_found",
    });
  });
});
