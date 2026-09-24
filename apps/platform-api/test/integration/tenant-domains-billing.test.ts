import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { appWithResolution } from "../support/platform-app-harness.js";

describe("tenant domains and billing", () => {
  it("lists domains for an authorized tenant member", async () => {
    let authorizationInput: { tenantId: string; userId: string } | undefined;
    let listInput: { tenantId: string } | undefined;
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        authorizeDashboardForTenant: async (input) => {
          authorizationInput = input;

          return {
            ok: true,
            actor: {
              id: "user_1",
              email: "owner@abebe.local",
              name: "Abebe Owner",
              role: "owner",
            },
          };
        },
        getSession: async () => ({
          user: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
          },
        }),
        listTenantDomains: async (input) => {
          listInput = input;

          return {
            ok: true,
            domains: [
              {
                id: "domain_1",
                hostname: "abebe.lvh.me",
                type: "platform_subdomain",
                status: "active",
                isPrimary: true,
                verificationStatus: "verified",
                sslStatus: "active",
              },
            ],
          };
        },
      },
    );

    const response = await app.request("/platform/tenants/tenant_1/domains");

    assert.equal(response.status, 200);
    assert.deepEqual(authorizationInput, {
      permission: { domains: ["manage"] },
      tenantId: "tenant_1",
      userId: "user_1",
    });
    assert.deepEqual(listInput, {
      tenantId: "tenant_1",
    });
    assert.deepEqual(await response.json(), {
      domains: [
        {
          id: "domain_1",
          hostname: "abebe.lvh.me",
          type: "platform_subdomain",
          status: "active",
          isPrimary: true,
          verificationStatus: "verified",
          sslStatus: "active",
        },
      ],
    });
  });

  it("adds a custom domain for an authorized tenant member", async () => {
    let createInput:
      | {
          hostname: string;
          tenantId: string;
          userId: string;
        }
      | undefined;
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        authorizeDashboardForTenant: async () => ({
          ok: true,
          actor: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
            role: "owner",
          },
        }),
        createTenantDomain: async (input) => {
          createInput = input;

          return {
            ok: true,
            domain: {
              id: "domain_2",
              hostname: "shop.example.com",
              type: "custom_domain",
              status: "pending_verification",
              isPrimary: false,
              verificationStatus: "pending",
              sslStatus: "pending",
            },
          };
        },
        getSession: async () => ({
          user: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
          },
        }),
      },
    );

    const response = await app.request("/platform/tenants/tenant_1/domains", {
      body: JSON.stringify({ hostname: " Shop.Example.com " }),
      headers: {
        "content-type": "application/json",
      },
      method: "POST",
    });

    assert.equal(response.status, 201);
    assert.deepEqual(createInput, {
      hostname: "Shop.Example.com",
      tenantId: "tenant_1",
      userId: "user_1",
    });
    assert.deepEqual(await response.json(), {
      domain: {
        id: "domain_2",
        hostname: "shop.example.com",
        type: "custom_domain",
        status: "pending_verification",
        isPrimary: false,
        verificationStatus: "pending",
        sslStatus: "pending",
      },
    });
  });

  it("verifies custom-domain ownership for an authorized tenant member", async () => {
    let verifyInput: unknown;
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        authorizeDashboardForTenant: async () => ({
          ok: true,
          actor: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
            role: "owner",
          },
        }),
        getSession: async () => ({
          user: { id: "user_1", email: "owner@abebe.local", name: "Abebe Owner" },
        }),
        verifyTenantDomainOwnership: async (input) => {
          verifyInput = input;
          return {
            ok: true,
            domain: {
              id: input.domainId,
              hostname: "shop.example.com",
              type: "custom_domain",
              status: "pending_certificate",
              isPrimary: false,
              verificationStatus: "verified",
              sslStatus: "pending",
            },
          };
        },
      },
    );

    const response = await app.request("/platform/tenants/tenant_1/domains/domain_2/verify", {
      method: "POST",
    });
    assert.equal(response.status, 200);
    assert.deepEqual(verifyInput, {
      domainId: "domain_2",
      tenantId: "tenant_1",
      userId: "user_1",
    });
  });

  it("sets a verified domain as the tenant primary domain", async () => {
    let primaryInput:
      | {
          domainId: string;
          tenantId: string;
          userId: string;
        }
      | undefined;
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        authorizeDashboardForTenant: async () => ({
          ok: true,
          actor: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
            role: "owner",
          },
        }),
        getSession: async () => ({
          user: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
          },
        }),
        setTenantPrimaryDomain: async (input) => {
          primaryInput = input;

          return {
            ok: true,
            domain: {
              id: input.domainId,
              hostname: "shop.example.com",
              type: "custom_domain",
              status: "active",
              isPrimary: true,
              verificationStatus: "verified",
              sslStatus: "active",
            },
          };
        },
      },
    );

    const response = await app.request("/platform/tenants/tenant_1/domains/domain_2/primary", {
      method: "POST",
    });

    assert.equal(response.status, 200);
    assert.deepEqual(primaryInput, {
      domainId: "domain_2",
      tenantId: "tenant_1",
      userId: "user_1",
    });
    assert.deepEqual(await response.json(), {
      domain: {
        id: "domain_2",
        hostname: "shop.example.com",
        type: "custom_domain",
        status: "active",
        isPrimary: true,
        verificationStatus: "verified",
        sslStatus: "active",
      },
    });
  });

  it("lists payment onboarding records for an authorized tenant member", async () => {
    let listInput: { tenantId: string } | undefined;
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        authorizeDashboardForTenant: async () => ({
          ok: true,
          actor: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
            role: "owner",
          },
        }),
        getSession: async () => ({
          user: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
          },
        }),
        listPaymentOnboarding: async (input) => {
          listInput = input;

          return {
            ok: true,
            paymentOnboarding: [
              {
                id: "payment_onboarding_1",
                provider: "chapa",
                status: "needs_review",
                requiredDocuments: ["business_license"],
                notes: "License uploaded.",
                providerAccountRef: null,
              },
            ],
          };
        },
      },
    );

    const response = await app.request("/platform/tenants/tenant_1/payments");

    assert.equal(response.status, 200);
    assert.deepEqual(listInput, {
      tenantId: "tenant_1",
    });
    assert.deepEqual(await response.json(), {
      paymentOnboarding: [
        {
          id: "payment_onboarding_1",
          provider: "chapa",
          status: "needs_review",
          requiredDocuments: ["business_license"],
          notes: "License uploaded.",
          providerAccountRef: null,
        },
      ],
    });
  });

  it("submits payment onboarding for operator review", async () => {
    let submitInput:
      | {
          notes?: string | null | undefined;
          provider: string;
          requiredDocuments: unknown[];
          tenantId: string;
          userId: string;
        }
      | undefined;
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        authorizeDashboardForTenant: async () => ({
          ok: true,
          actor: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
            role: "owner",
          },
        }),
        getSession: async () => ({
          user: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
          },
        }),
        submitPaymentOnboarding: async (input) => {
          submitInput = input;

          return {
            ok: true,
            paymentOnboarding: {
              id: "payment_onboarding_1",
              provider: "chapa",
              status: "needs_review",
              requiredDocuments: ["business_license"],
              notes: input.notes ?? null,
              providerAccountRef: null,
            },
          };
        },
      },
    );

    const response = await app.request("/platform/tenants/tenant_1/payments/onboarding", {
      body: JSON.stringify({
        provider: " Chapa ",
        requiredDocuments: ["business_license"],
        notes: " License uploaded. ",
      }),
      headers: {
        "content-type": "application/json",
      },
      method: "POST",
    });

    assert.equal(response.status, 200);
    assert.deepEqual(submitInput, {
      tenantId: "tenant_1",
      userId: "user_1",
      provider: "Chapa",
      requiredDocuments: ["business_license"],
      notes: "License uploaded.",
    });
    assert.deepEqual(await response.json(), {
      paymentOnboarding: {
        id: "payment_onboarding_1",
        provider: "chapa",
        status: "needs_review",
        requiredDocuments: ["business_license"],
        notes: "License uploaded.",
        providerAccountRef: null,
      },
    });
  });

  it("returns billing status for an authorized tenant member", async () => {
    let billingInput: { tenantId: string } | undefined;
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        authorizeDashboardForTenant: async () => ({
          ok: true,
          actor: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
            role: "owner",
          },
        }),
        getBillingStatus: async (input) => {
          billingInput = input;

          return {
            ok: true,
            billing: {
              subscription: {
                id: "subscription_1",
                planVersionId: "plan_version_1",
                status: "active",
                billingCycle: "monthly",
                manualPaymentState: "paid",
                currentPeriodStart: "2026-06-01T00:00:00.000Z",
                currentPeriodEnd: "2026-07-01T00:00:00.000Z",
              },
              plan: {
                id: "plan_1",
                name: "Starter",
                price: "999.00",
                limits: {
                  products: 100,
                },
                features: {
                  customDomain: false,
                },
                isFree: false,
              },
              availablePaidPlans: [],
              catalog: [
                {
                  id: "plan_1",
                  name: "Starter",
                  price: "999.00",
                  isFree: false,
                  isCurrent: true,
                },
              ],
              invoices: [
                {
                  id: "invoice_1",
                  amount: "999.00",
                  currency: "ETB",
                  status: "paid",
                  dueAt: "2026-06-05T00:00:00.000Z",
                  paidAt: "2026-06-02T00:00:00.000Z",
                  provider: "manual",
                  providerReference: "receipt_1",
                  createdAt: "2026-06-01T00:00:00.000Z",
                },
              ],
            },
          };
        },
        getSession: async () => ({
          user: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
          },
        }),
      },
    );

    const response = await app.request("/platform/tenants/tenant_1/billing");

    assert.equal(response.status, 200);
    assert.deepEqual(billingInput, {
      tenantId: "tenant_1",
    });
    assert.deepEqual(await response.json(), {
      billing: {
        subscription: {
          id: "subscription_1",
          planVersionId: "plan_version_1",
          status: "active",
          billingCycle: "monthly",
          manualPaymentState: "paid",
          currentPeriodStart: "2026-06-01T00:00:00.000Z",
          currentPeriodEnd: "2026-07-01T00:00:00.000Z",
        },
        plan: {
          id: "plan_1",
          name: "Starter",
          price: "999.00",
          limits: {
            products: 100,
          },
          features: {
            customDomain: false,
          },
          isFree: false,
        },
        availablePaidPlans: [],
        catalog: [
          {
            id: "plan_1",
            name: "Starter",
            price: "999.00",
            isFree: false,
            isCurrent: true,
          },
        ],
        invoices: [
          {
            id: "invoice_1",
            amount: "999.00",
            currency: "ETB",
            status: "paid",
            dueAt: "2026-06-05T00:00:00.000Z",
            paidAt: "2026-06-02T00:00:00.000Z",
            provider: "manual",
            providerReference: "receipt_1",
            createdAt: "2026-06-01T00:00:00.000Z",
          },
        ],
      },
    });
  });

  it("lets an operator review tenant payment onboarding", async () => {
    let reviewInput:
      | {
          notes?: string | null | undefined;
          operatorUserId: string;
          paymentOnboardingId: string;
          providerAccountRef?: string | null | undefined;
          status: string;
          tenantId: string;
        }
      | undefined;
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        authorizeDashboardForTenant: async () => ({
          ok: true,
          actor: {
            id: "operator_1",
            email: "operator@ecs.local",
            name: "Operator",
            role: "operator",
          },
        }),
        getSession: async () => ({
          session: { createdAt: new Date() },
          user: {
            id: "operator_1",
            email: "operator@ecs.local",
            name: "Operator",
          },
        }),
        authorizePlatformPermission: async ({ permission, userId }) => ({
          ok: true,
          permission,
          principal: { id: "principal_1", userId },
        }),
        reviewPaymentOnboarding: async (input) => {
          reviewInput = input;

          return {
            ok: true,
            paymentOnboarding: {
              id: input.paymentOnboardingId,
              provider: "chapa",
              status: input.status,
              requiredDocuments: ["business_license"],
              notes: input.reason,
              providerAccountRef: input.providerAccountRef ?? null,
            },
          };
        },
      },
    );

    const response = await app.request(
      "/platform/operator/tenants/tenant_1/payments/onboarding/payment_onboarding_1/review",
      {
        body: JSON.stringify({
          status: " approved ",
          reason: " Approved after license check. ",
          providerAccountRef: " chapa_subaccount_1 ",
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      },
    );

    assert.equal(response.status, 200);
    assert.deepEqual(reviewInput, {
      tenantId: "tenant_1",
      operatorUserId: "operator_1",
      platformPrincipalId: "principal_1",
      paymentOnboardingId: "payment_onboarding_1",
      status: "approved",
      reason: "Approved after license check.",
      providerAccountRef: "chapa_subaccount_1",
    });
    assert.deepEqual(await response.json(), {
      paymentOnboarding: {
        id: "payment_onboarding_1",
        provider: "chapa",
        status: "approved",
        requiredDocuments: ["business_license"],
        notes: "Approved after license check.",
        providerAccountRef: "chapa_subaccount_1",
      },
    });
  });
});
