# Signup Shop Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build central account signup and a strict shop onboarding wizard that provisions real tenant, Medusa, and storefront resources before redirecting merchants to their shop dashboard.

**Architecture:** Keep account creation separate from shop provisioning. Add platform endpoints for onboarding state and handle availability, extend tenant creation to accept storefront selection and return a redirect URL, then build dashboard routes for signup and guided onboarding that call those contracts.

**Tech Stack:** Next.js App Router dashboard, Better Auth, Hono platform API, Drizzle/Postgres, existing Medusa commerce provisioning client, shadcn/ui forms/cards/selects, Zod contracts in `packages/contracts`.

---

## File Structure

### Backend And Contracts

- Modify `packages/contracts/src/index.ts`
  - Add schemas/types for onboarding state, handle availability, signup/shop creation request helpers, and extended tenant mutation response.
- Modify `apps/platform-api/src/app.ts`
  - Add app option types for onboarding state and handle availability services.
- Modify `apps/platform-api/src/index.ts`
  - Wire new services into `createPlatformApp`.
- Modify `apps/platform-api/src/routes/platform-routes.ts`
  - Add `GET /platform/onboarding/state`.
  - Add `GET /platform/tenants/handle-availability`.
  - Extend `POST /platform/tenants` request body and response.
- Modify `apps/platform-api/src/tenants/tenant-list-service.ts`
  - Add reusable handle availability logic.
  - Add onboarding state service or small functions used by platform routes.
- Modify `apps/platform-api/src/provisioning/tenant-shop-provisioning.ts`
  - Accept optional selected template.
  - Return redirect-ready primary domain.
  - Preserve retry behavior.
- Modify `apps/platform-api/src/provisioning/tenant-shop-provisioning.test.ts`
  - Cover template selection and redirect-relevant output.
- Modify `apps/platform-api/src/app.test.ts`
  - Cover new platform routes and extended tenant creation response.

### Dashboard

- Create `apps/dashboard/src/app/admin/sign-up/page.tsx`
  - Server page for the central signup form.
- Create `apps/dashboard/src/app/admin/sign-up/session/route.ts`
  - POST route that validates signup form and calls Better Auth signup.
- Create `apps/dashboard/src/app/admin/sign-up/session/route.test.ts`
  - Tests validation, duplicate account mapping, cookie forwarding, and redirect.
- Create `apps/dashboard/src/app/admin/onboarding/page.tsx`
  - Server page that fetches onboarding state and templates.
- Create `apps/dashboard/src/app/admin/onboarding/actions/route.ts`
  - POST route for shop creation/provisioning from the wizard.
- Create `apps/dashboard/src/app/admin/onboarding/actions/route.test.ts`
  - Tests body validation, platform request forwarding, error mapping, and redirect URL handling.
- Create `apps/dashboard/src/features/onboarding/onboarding-workspace.tsx`
  - Client wizard for shop basics, storefront selection, provisioning, and failure state.
- Create `apps/dashboard/src/features/onboarding/onboarding-state.ts`
  - Pure helpers for handle slugification, validation messages, step transitions, and error mapping.
- Create `apps/dashboard/src/features/onboarding/onboarding-state.test.ts`
  - Unit tests for helper behavior.
- Create `apps/dashboard/src/lib/onboarding.ts`
  - Platform API client helpers for onboarding state, handle availability, and shop creation.
- Create `apps/dashboard/src/lib/onboarding.test.ts`
  - Unit tests for platform client parsing and error behavior.
- Modify `apps/dashboard/src/app/admin/sign-in/page.tsx`
  - Add sign-up link and central-host behavior copy.
- Modify `apps/dashboard/src/app/admin/session/route.ts`
  - Support central-host sign-in redirect to onboarding or primary shop when appropriate.
- Modify `apps/dashboard/src/app/admin/session/route.test.ts`
  - Cover central-host sign-in routing.
- Modify `apps/dashboard/src/features/overview/merchant-overview.tsx`
  - Add compact post-create checklist entry point with static MVP actions.

---

## Task 1: Contracts For Onboarding Responses

**Files:**
- Modify: `packages/contracts/src/index.ts`

- [ ] **Step 1: Add Zod schemas and exported types**

Add these near the existing platform tenant schemas:

```ts
export const platformOnboardingProvisioningAttemptSchema = z.object({
  id: z.string().min(1),
  handle: z.string().min(1),
  name: z.string().min(1).nullable(),
  status: z.string().min(1),
  step: z.string().min(1),
  error: z.string().min(1).nullable(),
});

export const platformOnboardingStateSchema = z.object({
  user: z.object({
    id: z.string().min(1),
    email: z.string().min(1),
    name: z.string().min(1).nullable(),
  }),
  tenants: z.array(platformTenantSchema),
  primaryTenant: z
    .object({
      id: z.string().min(1),
      handle: z.string().min(1),
      primaryDomain: z.string().min(1),
      dashboardUrl: z.string().min(1),
    })
    .nullable(),
  latestProvisioningAttempt: platformOnboardingProvisioningAttemptSchema.nullable(),
});

export const platformHandleAvailabilitySchema = z.object({
  handle: z.string().min(1),
  available: z.boolean(),
  reason: z.enum(["invalid", "reserved", "taken"]).optional(),
  hostname: z.string().min(1).optional(),
});

export const platformTenantCreateRequestSchema = z.object({
  name: z.string().trim().min(2).max(80),
  handle: z.string().trim().min(1),
  templateId: z.string().min(1).optional(),
  templateKey: z.string().min(1).optional(),
  businessCategory: z.string().trim().min(1).max(80).optional(),
  contactPhone: z.string().trim().min(1).max(40).optional(),
});

export type PlatformOnboardingState = z.infer<typeof platformOnboardingStateSchema>;
export type PlatformHandleAvailability = z.infer<typeof platformHandleAvailabilitySchema>;
export type PlatformTenantCreateRequest = z.infer<typeof platformTenantCreateRequestSchema>;
```

- [ ] **Step 2: Ensure mutation response already allows redirect**

Confirm `platformTenantMutationSchema` still includes:

```ts
redirectTo: z.string().min(1).nullable().optional(),
```

If it does not, add it.

- [ ] **Step 3: Run contract typecheck**

Run:

```bash
pnpm --filter @ecs/contracts typecheck
```

Expected: passes.

---

## Task 2: Backend Handle Availability And Onboarding State

**Files:**
- Modify: `apps/platform-api/src/tenants/tenant-list-service.ts`
- Modify: `apps/platform-api/src/app.ts`
- Modify: `apps/platform-api/src/index.ts`
- Modify: `apps/platform-api/src/routes/platform-routes.ts`
- Modify: `apps/platform-api/src/app.test.ts`

- [ ] **Step 1: Add service result types in `apps/platform-api/src/app.ts`**

Add exported types:

```ts
export type TenantHandleAvailabilityResult = {
  handle: string;
  available: boolean;
  reason?: "invalid" | "reserved" | "taken";
  hostname?: string;
};

export type PlatformOnboardingStateResult =
  | {
      ok: true;
      state: {
        user: {
          id: string;
          email: string;
          name: string | null;
        };
        tenants: TenantListItem[];
        primaryTenant: {
          id: string;
          handle: string;
          primaryDomain: string;
          dashboardUrl: string;
        } | null;
        latestProvisioningAttempt: {
          id: string;
          handle: string;
          name: string | null;
          status: string;
          step: string;
          error: string | null;
        } | null;
      };
    }
  | {
      ok: false;
      error: string;
      status: number;
    };
```

Extend `PlatformAppOptions` with:

```ts
getOnboardingState?: (input: { userId: string }) => Promise<PlatformOnboardingStateResult>;
checkTenantHandleAvailability?: (input: { handle: string }) => Promise<TenantHandleAvailabilityResult>;
```

- [ ] **Step 2: Add services in `tenant-list-service.ts`**

Add:

```ts
export function createTenantHandleAvailabilityService(options: {
  db: PlatformDb;
  platformBaseDomain: string;
}) {
  return async function checkTenantHandleAvailability(input: {
    handle: string;
  }): Promise<TenantHandleAvailabilityResult> {
    const handle = normalizeHandle(input.handle);
    const hostname = getPlatformHostname(handle, options.platformBaseDomain);

    if (!handlePattern.test(handle)) {
      return { handle, available: false, reason: "invalid", hostname };
    }

    const [reservedHandle] = await options.db
      .select({ id: reservedHandles.id })
      .from(reservedHandles)
      .where(eq(reservedHandles.handle, handle))
      .limit(1);

    if (reservedHandle) {
      return { handle, available: false, reason: "reserved", hostname };
    }

    const [existingTenant] = await options.db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.handle, handle))
      .limit(1);

    if (existingTenant) {
      return { handle, available: false, reason: "taken", hostname };
    }

    const [existingDomain] = await options.db
      .select({ id: domains.id })
      .from(domains)
      .where(eq(domains.hostname, hostname))
      .limit(1);

    if (existingDomain) {
      return { handle, available: false, reason: "taken", hostname };
    }

    return { handle, available: true, hostname };
  };
}
```

Add imports for `TenantHandleAvailabilityResult` from `../app.js`.

- [ ] **Step 3: Add onboarding state service**

In `tenant-list-service.ts`, add a function that composes existing tenant list data and latest provisioning attempt:

```ts
export function createPlatformOnboardingStateService(options: {
  db: PlatformDb;
  listTenantsForUser: (input: {
    limit: number;
    offset: number;
    userId: string;
  }) => Promise<TenantListResult>;
  platformBaseDomain: string;
}) {
  return async function getOnboardingState(input: {
    userId: string;
  }): Promise<PlatformOnboardingStateResult> {
    const [user] = await options.db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
      })
      .from(users)
      .where(eq(users.id, input.userId))
      .limit(1);

    if (!user) {
      return { ok: false, error: "auth_required", status: 401 };
    }

    const tenantsResult = await options.listTenantsForUser({
      limit: 20,
      offset: 0,
      userId: input.userId,
    });
    const primary = tenantsResult.tenants.find((tenant) => tenant.primaryDomain.hostname);

    const [attempt] = await options.db
      .select({
        id: tenantProvisioningAttempts.id,
        handle: tenantProvisioningAttempts.handle,
        name: tenantProvisioningAttempts.name,
        status: tenantProvisioningAttempts.status,
        step: tenantProvisioningAttempts.step,
        error: tenantProvisioningAttempts.error,
      })
      .from(tenantProvisioningAttempts)
      .where(eq(tenantProvisioningAttempts.ownerUserId, input.userId))
      .orderBy(desc(tenantProvisioningAttempts.createdAt))
      .limit(1);

    return {
      ok: true,
      state: {
        user,
        tenants: tenantsResult.tenants,
        primaryTenant:
          primary?.primaryDomain.hostname
            ? {
                id: primary.id,
                handle: primary.handle,
                primaryDomain: primary.primaryDomain.hostname,
                dashboardUrl: `http://${primary.primaryDomain.hostname}/admin`,
              }
            : null,
        latestProvisioningAttempt: attempt ?? null,
      },
    };
  };
}
```

Add `tenantProvisioningAttempts` import.

- [ ] **Step 4: Wire services in `apps/platform-api/src/index.ts`**

Import the two new service factories and create them near existing tenant services:

```ts
const checkTenantHandleAvailability = createTenantHandleAvailabilityService({
  db: platformDb.db,
  platformBaseDomain: env.STOREFRONT_PUBLIC_BASE_DOMAIN,
});

const getOnboardingState = createPlatformOnboardingStateService({
  db: platformDb.db,
  listTenantsForUser,
  platformBaseDomain: env.STOREFRONT_PUBLIC_BASE_DOMAIN,
});
```

Pass both into `createPlatformApp`.

- [ ] **Step 5: Add platform routes**

In `platform-routes.ts`, add:

```ts
app.get("/platform/onboarding/state", async (context) => {
  if (!options.getOnboardingState) {
    return context.json({ error: "onboarding_state_unavailable" }, 503);
  }

  const session = await options.getSession?.(context.req.raw.headers);

  if (!session) {
    return context.json({ error: "auth_required" }, 401);
  }

  const result = await options.getOnboardingState({ userId: session.user.id });

  if (!result.ok) {
    return context.json({ error: result.error }, result.status);
  }

  return context.json(result.state);
});

app.get("/platform/tenants/handle-availability", async (context) => {
  if (!options.checkTenantHandleAvailability) {
    return context.json({ error: "handle_availability_unavailable" }, 503);
  }

  const handle = context.req.query("handle") ?? "";
  const result = await options.checkTenantHandleAvailability({ handle });

  return context.json(result);
});
```

Place handle availability before `"/platform/tenants/:tenantId"` routes so it is not captured as a tenant id.

- [ ] **Step 6: Add platform route tests**

In `apps/platform-api/src/app.test.ts`, add tests:

```ts
it("returns onboarding state for the current platform user", async () => {
  let stateInput: { userId: string } | undefined;
  const app = appWithResolution(
    { ok: false, error: "shop_context_required" },
    {
      getSession: async () => ({
        user: { id: "user_1", email: "owner@example.com", name: "Owner" },
      }),
      getOnboardingState: async (input) => {
        stateInput = input;
        return {
          ok: true,
          state: {
            user: { id: "user_1", email: "owner@example.com", name: "Owner" },
            tenants: [],
            primaryTenant: null,
            latestProvisioningAttempt: null,
          },
        };
      },
    },
  );

  const response = await app.request("/platform/onboarding/state");

  assert.equal(response.status, 200);
  assert.deepEqual(stateInput, { userId: "user_1" });
  assert.deepEqual(await response.json(), {
    user: { id: "user_1", email: "owner@example.com", name: "Owner" },
    tenants: [],
    primaryTenant: null,
    latestProvisioningAttempt: null,
  });
});

it("checks tenant handle availability", async () => {
  let availabilityInput: { handle: string } | undefined;
  const app = appWithResolution(
    { ok: false, error: "shop_context_required" },
    {
      checkTenantHandleAvailability: async (input) => {
        availabilityInput = input;
        return {
          handle: "new-shop",
          available: true,
          hostname: "new-shop.lvh.me",
        };
      },
    },
  );

  const response = await app.request("/platform/tenants/handle-availability?handle=new-shop");

  assert.equal(response.status, 200);
  assert.deepEqual(availabilityInput, { handle: "new-shop" });
  assert.deepEqual(await response.json(), {
    handle: "new-shop",
    available: true,
    hostname: "new-shop.lvh.me",
  });
});
```

- [ ] **Step 7: Verify backend routes**

Run:

```bash
pnpm --filter @ecs/platform-api test
pnpm --filter @ecs/platform-api typecheck
```

Expected: both pass.

---

## Task 3: Tenant Creation Template Selection And Redirect

**Files:**
- Modify: `apps/platform-api/src/provisioning/tenant-shop-provisioning.ts`
- Modify: `apps/platform-api/src/provisioning/tenant-shop-provisioning.test.ts`
- Modify: `apps/platform-api/src/routes/platform-routes.ts`
- Modify: `apps/platform-api/src/app.test.ts`

- [ ] **Step 1: Extend provisioning input**

In `createTenantShopProvisioner`, extend input:

```ts
templateId?: string | undefined;
templateKey?: string | undefined;
```

Update `TenantShopProvisioningRetryOptions["createTenantShop"]` input the same way so retry can preserve template selection.

- [ ] **Step 2: Extend active template lookup**

Replace `findActiveStorefrontTemplate: () => Promise<ActiveStorefrontTemplate | undefined>` with:

```ts
findActiveStorefrontTemplate: (input?: {
  templateId?: string | undefined;
  templateKey?: string | undefined;
}) => Promise<ActiveStorefrontTemplate | undefined>;
```

In `createTenantShopProvisioningService`, implement this by:

- If `templateId` is passed, find active template/version by template id.
- If `templateKey` is passed, find active template version by template key.
- Otherwise keep current active default behavior.

- [ ] **Step 3: Return `template_unavailable`**

In `createTenantShop`, after resolving template, if no template exists return:

```ts
{
  ok: false,
  error: "template_unavailable",
  status: 400,
}
```

- [ ] **Step 4: Pass selected template through route**

In `POST /platform/tenants`, parse:

```ts
const templateId = getOptionalBodyString(body, "templateId");
const templateKey = getOptionalBodyString(body, "templateKey");
```

Pass them to `options.createTenantShop`.

- [ ] **Step 5: Return redirect URL**

Update route success response to include:

```ts
redirectTo: `http://${result.tenant.primaryDomain.hostname}/admin`
```

Use a helper if one already exists for platform/dashboard URL creation.

- [ ] **Step 6: Add tests**

In `tenant-shop-provisioning.test.ts`, add:

```ts
it("uses a selected storefront template when provisioning a shop", async () => {
  let templateInput: { templateKey?: string | undefined } | undefined;
  const createTenantShop = createTenantShopProvisioner({
    ...baseProvisionerOptions(),
    findActiveStorefrontTemplate: async (input) => {
      templateInput = input;
      return {
        templateId: "template_selected",
        templateVersion: 2,
        defaultData: {},
        defaultThemeTokens: {},
      };
    },
  });

  const result = await createTenantShop({
    handle: "new-shop",
    name: "New Shop",
    ownerUserId: "user_1",
    templateKey: "selected@2",
  });

  assert.equal(result.ok, true);
  assert.deepEqual(templateInput, { templateKey: "selected@2" });
});
```

Adapt `baseProvisionerOptions()` to the local test helpers in that file.

In `app.test.ts`, update tenant creation test expected JSON to include `redirectTo`.

- [ ] **Step 7: Verify backend**

Run:

```bash
pnpm --filter @ecs/platform-api test
pnpm --filter @ecs/platform-api typecheck
```

Expected: both pass.

---

## Task 4: Dashboard Onboarding API Client

**Files:**
- Create: `apps/dashboard/src/lib/onboarding.ts`
- Create: `apps/dashboard/src/lib/onboarding.test.ts`

- [ ] **Step 1: Implement client helpers**

Create:

```ts
import {
  platformErrorSchema,
  platformHandleAvailabilitySchema,
  platformOnboardingStateSchema,
  platformTenantMutationSchema,
  type PlatformHandleAvailability,
  type PlatformOnboardingState,
  type PlatformTenantMutation,
} from "@ecs/contracts";

type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; status: number };

export async function getOnboardingState(options: {
  cookieHeader?: string | null | undefined;
  fetcher?: typeof fetch;
  platformApiBaseUrl: string;
}): Promise<ApiResult<PlatformOnboardingState>> {
  const response = await (options.fetcher ?? fetch)(
    new URL("/platform/onboarding/state", normalizeBaseUrl(options.platformApiBaseUrl)),
    {
      cache: "no-store",
      headers: getJsonHeaders(options.cookieHeader),
    },
  ).catch(() => null);

  return parseResponse(response, platformOnboardingStateSchema, "invalid_onboarding_state_response");
}

export async function checkHandleAvailability(options: {
  fetcher?: typeof fetch;
  handle: string;
  platformApiBaseUrl: string;
}): Promise<ApiResult<PlatformHandleAvailability>> {
  const url = new URL(
    "/platform/tenants/handle-availability",
    normalizeBaseUrl(options.platformApiBaseUrl),
  );
  url.searchParams.set("handle", options.handle);

  const response = await (options.fetcher ?? fetch)(url, { cache: "no-store" }).catch(() => null);

  return parseResponse(response, platformHandleAvailabilitySchema, "invalid_handle_response");
}

export async function createTenantShop(options: {
  cookieHeader?: string | null | undefined;
  fetcher?: typeof fetch;
  platformApiBaseUrl: string;
  shop: {
    name: string;
    handle: string;
    templateKey?: string | undefined;
    templateId?: string | undefined;
    businessCategory?: string | undefined;
    contactPhone?: string | undefined;
  };
}): Promise<ApiResult<PlatformTenantMutation>> {
  const response = await (options.fetcher ?? fetch)(
    new URL("/platform/tenants", normalizeBaseUrl(options.platformApiBaseUrl)),
    {
      body: JSON.stringify(options.shop),
      cache: "no-store",
      headers: getJsonHeaders(options.cookieHeader),
      method: "POST",
    },
  ).catch(() => null);

  return parseResponse(response, platformTenantMutationSchema, "invalid_tenant_create_response");
}

async function parseResponse<T>(
  response: Response | null,
  schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false } },
  invalidMessage: string,
): Promise<ApiResult<T>> {
  if (!response) {
    return { ok: false, status: 503, message: "platform_request_failed" };
  }

  const data = await response.json().catch(() => undefined);

  if (!response.ok) {
    const error = platformErrorSchema.safeParse(data);
    return {
      ok: false,
      status: response.status,
      message: error.success ? error.data.error : response.statusText || "Request failed",
    };
  }

  const parsed = schema.safeParse(data);

  if (!parsed.success) {
    return { ok: false, status: 502, message: invalidMessage };
  }

  return { ok: true, data: parsed.data };
}

function getJsonHeaders(cookieHeader?: string | null | undefined) {
  const headers = new Headers({ accept: "application/json", "content-type": "application/json" });
  if (cookieHeader?.trim()) headers.set("cookie", cookieHeader.trim());
  return headers;
}

function normalizeBaseUrl(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}
```

- [ ] **Step 2: Add client tests**

Create tests that assert URLs, cookies, JSON bodies, and invalid response handling:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { checkHandleAvailability, createTenantShop, getOnboardingState } from "./onboarding.js";

describe("onboarding platform helpers", () => {
  it("fetches onboarding state with the forwarded cookie", async () => {
    let request: Request | undefined;
    const result = await getOnboardingState({
      cookieHeader: "better-auth.session_token=session_1",
      platformApiBaseUrl: "http://platform.local",
      fetcher: async (input, init) => {
        request = new Request(input, init);
        return Response.json({
          user: { id: "user_1", email: "owner@example.com", name: "Owner" },
          tenants: [],
          primaryTenant: null,
          latestProvisioningAttempt: null,
        });
      },
    });

    assert.equal(result.ok, true);
    assert.equal(request?.url, "http://platform.local/platform/onboarding/state");
    assert.equal(request?.headers.get("cookie"), "better-auth.session_token=session_1");
  });

  it("checks handle availability", async () => {
    let request: Request | undefined;
    const result = await checkHandleAvailability({
      handle: "new-shop",
      platformApiBaseUrl: "http://platform.local",
      fetcher: async (input, init) => {
        request = new Request(input, init);
        return Response.json({
          handle: "new-shop",
          available: true,
          hostname: "new-shop.lvh.me",
        });
      },
    });

    assert.equal(result.ok, true);
    assert.equal(
      request?.url,
      "http://platform.local/platform/tenants/handle-availability?handle=new-shop",
    );
  });

  it("creates a tenant shop with selected template", async () => {
    let request: Request | undefined;
    const result = await createTenantShop({
      cookieHeader: "better-auth.session_token=session_1",
      platformApiBaseUrl: "http://platform.local",
      shop: {
        name: "New Shop",
        handle: "new-shop",
        templateKey: "classic@1",
      },
      fetcher: async (input, init) => {
        request = new Request(input, init);
        return Response.json({
          tenant: {
            id: "tenant_1",
            name: "New Shop",
            handle: "new-shop",
            status: "active",
            role: "owner",
            primaryDomain: { hostname: "new-shop.lvh.me" },
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
          redirectTo: "http://new-shop.lvh.me/admin",
        });
      },
    });

    assert.equal(result.ok, true);
    assert.equal(request?.method, "POST");
    assert.deepEqual(await request?.json(), {
      name: "New Shop",
      handle: "new-shop",
      templateKey: "classic@1",
    });
  });
});
```

- [ ] **Step 3: Run dashboard helper tests**

Run:

```bash
pnpm --filter @ecs/dashboard test -- src/lib/onboarding.test.ts
pnpm --filter @ecs/dashboard typecheck
```

Expected: both pass.

---

## Task 5: Dashboard Sign-up Route And Form

**Files:**
- Create: `apps/dashboard/src/app/admin/sign-up/page.tsx`
- Create: `apps/dashboard/src/app/admin/sign-up/session/route.ts`
- Create: `apps/dashboard/src/app/admin/sign-up/session/route.test.ts`
- Create: `apps/dashboard/src/components/app/sign-up-form.tsx`
- Modify: `apps/dashboard/src/app/admin/sign-in/page.tsx`

- [ ] **Step 1: Add sign-up form component**

Create `sign-up-form.tsx` as a client component using the same shadcn form primitives as sign-in:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";

import { AppIcons } from "@/components/app/icons";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";

export function SignUpForm({ errorMessage }: { errorMessage: string | null }) {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const PasswordIcon = isPasswordVisible ? AppIcons.eyeOff : AppIcons.eye;

  return (
    <form action="/admin/sign-up/session" className="flex flex-col gap-5" method="post">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="name">Full name</FieldLabel>
          <InputGroup className="h-11 rounded-full bg-background/70 px-1">
            <InputGroupInput id="name" name="name" autoComplete="name" required className="px-3 text-sm" />
          </InputGroup>
        </Field>
        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <InputGroup className="h-11 rounded-full bg-background/70 px-1">
            <InputGroupInput id="email" name="email" autoComplete="email" required type="email" className="px-3 text-sm" />
          </InputGroup>
        </Field>
        <Field>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <InputGroup className="h-11 rounded-full bg-background/70 px-1">
            <InputGroupInput
              id="password"
              name="password"
              autoComplete="new-password"
              required
              type={isPasswordVisible ? "text" : "password"}
              className="px-3 text-sm"
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                aria-label={isPasswordVisible ? "Hide password" : "Show password"}
                onClick={() => setIsPasswordVisible((value) => !value)}
                size="icon-xs"
              >
                <PasswordIcon />
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
          <FieldDescription>Use at least 8 characters.</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="confirmPassword">Confirm password</FieldLabel>
          <InputGroup className="h-11 rounded-full bg-background/70 px-1">
            <InputGroupInput id="confirmPassword" name="confirmPassword" autoComplete="new-password" required type="password" className="px-3 text-sm" />
          </InputGroup>
        </Field>
        {errorMessage ? (
          <Field data-invalid>
            <FieldError>{errorMessage}</FieldError>
          </Field>
        ) : null}
      </FieldGroup>
      <Button className="h-11 rounded-full text-sm font-semibold shadow-sm" type="submit">
        Create account
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link className="font-medium text-foreground hover:text-primary" href="/admin/sign-in">
          Sign in
        </Link>
      </p>
    </form>
  );
}
```

- [ ] **Step 2: Add sign-up page**

Create `page.tsx` matching the sign-in page layout:

```tsx
import { SignUpForm } from "@/components/app/sign-up-form";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AdminSignUpPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const errorMessage = getErrorMessage(params?.error);

  return (
    <main className="min-h-screen bg-background px-5 py-8 text-foreground">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md items-center">
        <Card className="w-full rounded-3xl border border-border/70 bg-card/95 shadow-xl shadow-primary/5 backdrop-blur [--card-spacing:--spacing(5)]">
          <CardHeader className="gap-1.5">
            <div className="text-xs font-bold tracking-normal text-muted-foreground uppercase">
              Merchant dashboard
            </div>
            <CardTitle className="text-xl font-semibold">Create your merchant account</CardTitle>
            <CardDescription>Set up your account first, then create your shop.</CardDescription>
            <CardAction>
              <ThemeToggle />
            </CardAction>
          </CardHeader>
          <CardContent className="pt-1">
            <SignUpForm errorMessage={errorMessage} />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function getErrorMessage(value: string | undefined) {
  switch (value) {
    case "missing_name":
      return "Enter your name.";
    case "missing_email":
      return "Enter an email address.";
    case "password_short":
      return "Use at least 8 characters for your password.";
    case "password_mismatch":
      return "Passwords do not match.";
    case "account_exists":
      return "An account already exists for this email. Sign in instead.";
    case "auth_unavailable":
      return "Account creation is temporarily unavailable.";
    default:
      return null;
  }
}
```

- [ ] **Step 3: Add sign-up proxy route**

Create `route.ts` similar to `/admin/session/route.ts`, but call Better Auth signup:

```ts
import { createAuthClient } from "better-auth/client";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const formData = await request.formData();
  const name = getFormString(formData, "name");
  const email = getFormString(formData, "email")?.toLowerCase();
  const password = getFormString(formData, "password");
  const confirmPassword = getFormString(formData, "confirmPassword");

  if (!name) return redirectToSignUp(request, "missing_name");
  if (!email) return redirectToSignUp(request, "missing_email");
  if (!password || password.length < 8) return redirectToSignUp(request, "password_short");
  if (password !== confirmPassword) return redirectToSignUp(request, "password_mismatch");

  const authResult = await signUpWithPlatformAuth({
    email,
    forwardedHost: request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "",
    forwardedProto: request.headers.get("x-forwarded-proto") ?? "http",
    name,
    password,
  });

  if (!authResult.ok) {
    return redirectToSignUp(
      request,
      authResult.status === 409 ? "account_exists" : "auth_unavailable",
    );
  }

  const response = NextResponse.redirect(getRedirectUrl("/admin/onboarding", request), { status: 303 });
  for (const cookie of authResult.cookies) response.headers.append("set-cookie", cookie);
  return response;
}
```

Reuse helper functions from `/admin/session/route.ts` by extracting shared helpers to `apps/dashboard/src/lib/auth-route-helpers.ts` if duplication grows beyond 30 lines. Otherwise keep local helpers for this task.

- [ ] **Step 4: Add route tests**

Follow `apps/dashboard/src/app/admin/session/route.test.ts` patterns. Cover:

- missing name redirects with `error=missing_name`
- password mismatch redirects with `error=password_mismatch`
- successful signup redirects to `/admin/onboarding`
- successful signup forwards `set-cookie`
- duplicate account maps to `account_exists`

- [ ] **Step 5: Add sign-up link to sign-in page**

In `sign-in/page.tsx`, add a small link below the sign-in form:

```tsx
<p className="mt-5 text-center text-sm text-muted-foreground">
  New here?{" "}
  <Link className="font-medium text-foreground hover:text-primary" href="/admin/sign-up">
    Create an account
  </Link>
</p>
```

Import `Link` from `next/link`.

- [ ] **Step 6: Verify dashboard signup**

Run:

```bash
pnpm --filter @ecs/dashboard test -- src/app/admin/sign-up/session/route.test.ts
pnpm --filter @ecs/dashboard test -- src/app/admin/session/route.test.ts
pnpm --filter @ecs/dashboard typecheck
```

Expected: all pass.

---

## Task 6: Central Sign-in Redirect Behavior

**Files:**
- Modify: `apps/dashboard/src/app/admin/session/route.ts`
- Modify: `apps/dashboard/src/app/admin/session/route.test.ts`
- Modify: `apps/dashboard/src/lib/onboarding.ts`

- [ ] **Step 1: Detect central host after sign-in**

In `/admin/session/route.ts`, after successful sign-in, if `validateShopHost` returns `shop_context_required` for central/system host, do not fail. Instead sign in centrally and fetch onboarding state using the returned cookies.

Keep shop-subdomain behavior strict.

- [ ] **Step 2: Add redirect resolver**

Add helper:

```ts
async function getPostSignInRedirect(input: {
  cookies: string[];
  fallbackPath: string;
  platformApiBaseUrl: string;
}) {
  const cookieHeader = input.cookies.join("; ");
  const state = await getOnboardingState({
    cookieHeader,
    platformApiBaseUrl: input.platformApiBaseUrl,
  });

  if (!state.ok) return input.fallbackPath;
  if (!state.data.primaryTenant) return "/admin/onboarding";
  return state.data.primaryTenant.dashboardUrl;
}
```

Use absolute URL redirect if the returned path starts with `http`.

- [ ] **Step 3: Add route tests**

Add tests:

- central host sign-in with no tenants redirects to `/admin/onboarding`
- central host sign-in with primary tenant redirects to `http://shop.lvh.me/admin`
- shop host still rejects unknown shops with `shop_not_found`

- [ ] **Step 4: Verify sign-in behavior**

Run:

```bash
pnpm --filter @ecs/dashboard test -- src/app/admin/session/route.test.ts
pnpm --filter @ecs/dashboard typecheck
```

Expected: both pass.

---

## Task 7: Onboarding Wizard Page And State Helpers

**Files:**
- Create: `apps/dashboard/src/app/admin/onboarding/page.tsx`
- Create: `apps/dashboard/src/features/onboarding/onboarding-workspace.tsx`
- Create: `apps/dashboard/src/features/onboarding/onboarding-state.ts`
- Create: `apps/dashboard/src/features/onboarding/onboarding-state.test.ts`
- Modify: `apps/dashboard/src/lib/routes.ts`

- [ ] **Step 1: Add pure onboarding helpers**

Create:

```ts
export type OnboardingStep = "shop" | "storefront" | "provisioning" | "failed";

const handlePattern = /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/;

export function slugifyShopHandle(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
}

export function validateShopName(value: string) {
  const trimmed = value.trim();
  if (trimmed.length < 2) return "Enter a shop name.";
  if (trimmed.length > 80) return "Use 80 characters or fewer.";
  return null;
}

export function validateShopHandle(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return "Enter a shop address.";
  if (!handlePattern.test(normalized)) {
    return "Use lowercase letters, numbers, and hyphens. Do not start or end with a hyphen.";
  }
  return null;
}

export function getHandleAvailabilityMessage(reason: string | undefined) {
  switch (reason) {
    case "invalid":
      return "This shop address is not valid.";
    case "reserved":
      return "This shop address is reserved.";
    case "taken":
      return "This shop address is already taken.";
    default:
      return "This shop address is unavailable.";
  }
}

export function mapProvisioningError(value: string | null | undefined) {
  switch (value) {
    case "handle_unavailable":
      return "This shop address is no longer available.";
    case "template_unavailable":
      return "This storefront is no longer available.";
    default:
      return "Shop setup could not be completed.";
  }
}
```

- [ ] **Step 2: Add helper tests**

Test slugification, valid/invalid handles, and error mapping.

- [ ] **Step 3: Add onboarding page**

Server page:

- reads cookies
- calls `getOnboardingState`
- redirects to `/admin/sign-in` when unauthenticated
- redirects to `state.primaryTenant.dashboardUrl` when present
- fetches storefront templates
- renders `OnboardingWorkspace`

Use `redirect` from `next/navigation`.

- [ ] **Step 4: Add onboarding workspace**

Build a client component with:

- local wizard state
- shop name/handle/category/phone fields
- debounced handle availability check
- template selection grid
- provisioning submit via `/admin/onboarding/actions`
- failure state with retry/edit actions

Use existing shadcn `Card`, `Button`, `Field`, `InputGroup`, `Select`, and `Badge` components. Keep copy concise.

- [ ] **Step 5: Add route constants**

In `apps/dashboard/src/lib/routes.ts`, add:

```ts
signUp: "/admin/sign-up",
onboarding: "/admin/onboarding",
```

Use existing route object conventions.

- [ ] **Step 6: Verify wizard helpers**

Run:

```bash
pnpm --filter @ecs/dashboard test -- src/features/onboarding/onboarding-state.test.ts
pnpm --filter @ecs/dashboard typecheck
```

Expected: both pass.

---

## Task 8: Onboarding Provisioning Action

**Files:**
- Create: `apps/dashboard/src/app/admin/onboarding/actions/route.ts`
- Create: `apps/dashboard/src/app/admin/onboarding/actions/route.test.ts`

- [ ] **Step 1: Create POST action route**

Route behavior:

- Read JSON body from wizard.
- Validate `name`, `handle`, and `templateKey`.
- Forward session cookie to platform.
- Call `createTenantShop`.
- Return `{ ok: true, redirectTo }` on success.
- Return `{ ok: false, message }` on safe failure.

Implementation skeleton:

```ts
import { NextResponse } from "next/server";

import { createTenantShop } from "@/lib/onboarding";

export async function POST(request: Request) {
  const body = await request.json().catch(() => undefined);
  const name = getString(body, "name");
  const handle = getString(body, "handle");
  const templateKey = getString(body, "templateKey");

  if (!name || !handle || !templateKey) {
    return NextResponse.json({ ok: false, message: "missing_required_fields" }, { status: 400 });
  }

  const result = await createTenantShop({
    cookieHeader: request.headers.get("cookie"),
    platformApiBaseUrl: process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000",
    shop: { name, handle, templateKey },
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.message }, { status: result.status });
  }

  return NextResponse.json({
    ok: true,
    redirectTo: result.data.redirectTo ?? `http://${result.data.tenant.primaryDomain.hostname}/admin`,
  });
}
```

- [ ] **Step 2: Add action tests**

Cover:

- missing required fields returns 400
- forwards cookie and selected template
- platform failure maps to safe JSON
- success returns redirect URL

- [ ] **Step 3: Wire workspace submit**

In `OnboardingWorkspace`, `fetch("/admin/onboarding/actions", { method: "POST", body })`.

On success:

```ts
window.location.assign(body.redirectTo);
```

On failure: set failed step with `mapProvisioningError(body.message)`.

- [ ] **Step 4: Verify action route**

Run:

```bash
pnpm --filter @ecs/dashboard test -- src/app/admin/onboarding/actions/route.test.ts
pnpm --filter @ecs/dashboard typecheck
```

Expected: both pass.

---

## Task 9: Dashboard Checklist Entry Point

**Files:**
- Create: `apps/dashboard/src/features/onboarding/dashboard-checklist.tsx`
- Modify: `apps/dashboard/src/features/overview/merchant-overview.tsx`

- [ ] **Step 1: Create checklist component**

Create a compact card:

```tsx
import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { dashboardRoutes } from "@/lib/routes";

const checklistItems = [
  { label: "Add first product", href: dashboardRoutes.products },
  { label: "Review storefront", href: dashboardRoutes.editor },
  { label: "Configure delivery", href: dashboardRoutes.settings },
  { label: "Set up payments", href: dashboardRoutes.billing },
  { label: "Review shop settings", href: dashboardRoutes.settings },
] as const;

export function DashboardChecklist() {
  return (
    <Card className="self-start">
      <CardHeader>
        <CardTitle>Shop setup</CardTitle>
        <CardDescription>Finish the operational steps that make the shop ready to sell.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {checklistItems.map((item) => (
          <Link
            className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-muted/50"
            href={item.href}
            key={item.label}
          >
            <span>{item.label}</span>
            <span className="text-muted-foreground">Open</span>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Add checklist to overview**

Place it near `Needs Attention` or lower summary area where it does not crowd the analytics cards.

For MVP, render it unconditionally for now. A later task can hide completed checklist items when backend completion signals exist.

- [ ] **Step 3: Verify dashboard**

Run:

```bash
pnpm --filter @ecs/dashboard typecheck
pnpm --filter @ecs/dashboard test
pnpm --filter @ecs/dashboard build
```

Expected: all pass.

---

## Task 10: Full Verification

**Files:**
- All modified files from Tasks 1-9

- [ ] **Step 1: Run backend checks**

```bash
pnpm --filter @ecs/platform-api typecheck
pnpm --filter @ecs/platform-api test
```

Expected: both pass.

- [ ] **Step 2: Run dashboard checks**

```bash
pnpm --filter @ecs/dashboard typecheck
pnpm --filter @ecs/dashboard test
pnpm --filter @ecs/dashboard build
```

Expected: all pass.

- [ ] **Step 3: Run workspace checks**

```bash
git diff --check
git status --short
```

Expected:

- `git diff --check` prints no output.
- `git status --short` shows only expected implementation files plus any pre-existing dirty files that were already present before this feature.

- [ ] **Step 4: Manual QA**

Run the app locally and verify:

- central `/admin/sign-up` creates account and lands on onboarding
- central `/admin/sign-in` sends no-shop users to onboarding
- shop basics validates handles and shows live address
- storefront step requires template selection
- successful provisioning redirects to `{handle}.lvh.me/admin`
- failed provisioning stays in onboarding with retry/edit choices
- shop subdomain sign-in remains membership-scoped
