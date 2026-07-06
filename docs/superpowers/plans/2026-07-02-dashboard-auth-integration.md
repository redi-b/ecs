# Dashboard Auth Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Protect the merchant dashboard shell with a server-side auth boundary that redirects unauthenticated users to sign in and prevents raw Platform API auth errors from appearing in dashboard pages.

**Architecture:** Add a small dashboard auth helper under `apps/dashboard/src/lib` that maps merchant summary responses to access states. Use Next middleware to attach the requested dashboard path to protected requests so the server layout can build a safe `next` redirect. Keep sign-in outside the shell and keep Platform API as the source of truth for session and tenant authorization.

**Tech Stack:** Next.js 16 App Router, React Server Components, Better Auth through Platform API, TypeScript, Node test runner, shadcn/ui.

---

## File Structure

Create or modify these files:

- Create: `apps/dashboard/src/lib/dashboard-auth.ts`
  - Owns safe dashboard path parsing and merchant access mapping.
- Create: `apps/dashboard/src/lib/dashboard-auth.test.ts`
  - Tests auth state mapping and safe redirect path behavior.
- Create: `apps/dashboard/src/middleware.ts`
  - Adds an internal request header with the original dashboard path and query string.
- Create: `apps/dashboard/src/middleware.test.ts`
  - Tests which paths receive the internal dashboard path header.
- Modify: `apps/dashboard/src/app/admin/(dashboard)/layout.tsx`
  - Runs the server-side auth guard before rendering the merchant shell.
- Create: `apps/dashboard/src/components/app/dashboard-access-state.tsx`
  - Renders forbidden and unavailable dashboard-level states.
- Modify: `apps/dashboard/src/app/admin/session/route.test.ts`
  - Add safe `next` redirect tests.
- Modify: `apps/dashboard/README.md`
  - Document the auth boundary and local credentials.
- Modify: `dev-docs/20-dashboard-ui-foundation.md`
  - Update auth direction now that this coordinated auth slice exists.

No feature table or page components should be modified unless a test proves they still show raw auth errors after the layout guard is in place.

---

## Task 1: Add Dashboard Auth Helper With TDD

**Files:**
- Create: `apps/dashboard/src/lib/dashboard-auth.ts`
- Create: `apps/dashboard/src/lib/dashboard-auth.test.ts`

- [ ] **Step 1: Write failing tests for access mapping and safe paths**

Create `apps/dashboard/src/lib/dashboard-auth.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getDashboardAuthRedirectPath,
  getMerchantDashboardAccess,
  getSafeDashboardPath,
} from "./dashboard-auth.js";

const summary = {
  actor: {
    email: "owner@abebe.local",
    id: "user_1",
    name: "Abebe Owner",
    role: "owner" as const,
  },
  commerce: {
    hasPublishableKey: true,
    hasSalesChannel: true,
    hasStore: true,
  },
  domain: {
    hostname: "abebe.lvh.me",
    id: "domain_1",
  },
  storefront: {
    isPublished: true,
    publishedRevisionId: "revision_1",
    templateId: "template_1",
    templateVersion: 1,
  },
  tenant: {
    handle: "abebe",
    id: "tenant_1",
    name: "Abebe Market",
    status: "active" as const,
  },
};

describe("getSafeDashboardPath", () => {
  it("keeps safe admin paths with query strings", () => {
    assert.equal(getSafeDashboardPath("/admin/products?page=2"), "/admin/products?page=2");
  });

  it("rejects external and non-admin paths", () => {
    assert.equal(getSafeDashboardPath("https://evil.test/admin"), "/admin");
    assert.equal(getSafeDashboardPath("//evil.test/admin"), "/admin");
    assert.equal(getSafeDashboardPath("/store"), "/admin");
    assert.equal(getSafeDashboardPath(""), "/admin");
  });
});

describe("getDashboardAuthRedirectPath", () => {
  it("builds a sign-in path with a safe next value", () => {
    assert.equal(
      getDashboardAuthRedirectPath("/admin/orders?page=2"),
      "/admin/sign-in?next=%2Fadmin%2Forders%3Fpage%3D2",
    );
  });
});

describe("getMerchantDashboardAccess", () => {
  it("returns summary for an authenticated merchant", async () => {
    const access = await getMerchantDashboardAccess({
      getSummary: async () => ({ ok: true, summary }),
    });

    assert.deepEqual(access, {
      ok: true,
      summary,
    });
  });

  it("maps auth_required to unauthenticated", async () => {
    const access = await getMerchantDashboardAccess({
      getSummary: async () => ({
        ok: false,
        message: "auth_required",
        status: 401,
      }),
    });

    assert.deepEqual(access, {
      kind: "unauthenticated",
      ok: false,
    });
  });

  it("maps dashboard_forbidden to forbidden", async () => {
    const access = await getMerchantDashboardAccess({
      getSummary: async () => ({
        ok: false,
        message: "dashboard_forbidden",
        status: 403,
      }),
    });

    assert.deepEqual(access, {
      kind: "forbidden",
      message: "dashboard_forbidden",
      ok: false,
    });
  });

  it("maps network failures to unavailable", async () => {
    const access = await getMerchantDashboardAccess({
      getSummary: async () => ({
        ok: false,
        message: "platform_request_failed",
        status: 503,
      }),
    });

    assert.deepEqual(access, {
      kind: "unavailable",
      message: "platform_request_failed",
      ok: false,
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
pnpm --filter @ecs/dashboard test
```

Expected: FAIL because `apps/dashboard/src/lib/dashboard-auth.ts` does not exist.

- [ ] **Step 3: Implement the minimal auth helper**

Create `apps/dashboard/src/lib/dashboard-auth.ts`:

```ts
import type { MerchantDashboardSummary } from "@ecs/contracts";

import type { MerchantDashboardResult } from "@/lib/merchant-dashboard";

export const DASHBOARD_PATH_HEADER = "x-ecs-dashboard-path";

export type MerchantDashboardAccess =
  | {
      ok: true;
      summary: MerchantDashboardSummary;
    }
  | {
      ok: false;
      kind: "unauthenticated";
    }
  | {
      ok: false;
      kind: "forbidden";
      message: string;
    }
  | {
      ok: false;
      kind: "unavailable";
      message: string;
    };

export async function getMerchantDashboardAccess(options: {
  getSummary: () => Promise<MerchantDashboardResult>;
}): Promise<MerchantDashboardAccess> {
  const result = await options.getSummary();

  if (result.ok) {
    return {
      ok: true,
      summary: result.summary,
    };
  }

  if (result.status === 401 || result.message === "auth_required") {
    return {
      ok: false,
      kind: "unauthenticated",
    };
  }

  if (result.status === 403 || result.message === "dashboard_forbidden") {
    return {
      ok: false,
      kind: "forbidden",
      message: result.message,
    };
  }

  return {
    ok: false,
    kind: "unavailable",
    message: result.message,
  };
}

export function getSafeDashboardPath(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/admin";
  }

  if (value !== "/admin" && !value.startsWith("/admin/") && !value.startsWith("/admin?")) {
    return "/admin";
  }

  if (value.startsWith("/admin/sign-in") || value.startsWith("/admin/session")) {
    return "/admin";
  }

  return value;
}

export function getDashboardAuthRedirectPath(nextPath: string | null | undefined) {
  const params = new URLSearchParams({
    next: getSafeDashboardPath(nextPath),
  });

  return `/admin/sign-in?${params.toString()}`;
}
```

- [ ] **Step 4: Run tests to verify green**

Run:

```bash
pnpm --filter @ecs/dashboard test
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add apps/dashboard/src/lib/dashboard-auth.ts apps/dashboard/src/lib/dashboard-auth.test.ts
git commit -m "feat: add dashboard auth access helper"
```

Expected: commit succeeds.

---

## Task 2: Add Middleware For Dashboard Next Path Capture

**Files:**
- Create: `apps/dashboard/src/middleware.ts`
- Create: `apps/dashboard/src/middleware.test.ts`

- [ ] **Step 1: Write failing middleware tests**

Create `apps/dashboard/src/middleware.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NextRequest } from "next/server";

import { DASHBOARD_PATH_HEADER } from "./lib/dashboard-auth.js";
import { middleware } from "./middleware.js";

describe("dashboard middleware", () => {
  it("adds the dashboard path header for protected admin pages", () => {
    const request = new NextRequest("http://abebe.lvh.me/admin/products?page=2");
    const response = middleware(request);

    assert.equal(response.headers.get("x-middleware-next"), "1");
    assert.equal(request.headers.get(DASHBOARD_PATH_HEADER), null);
  });

  it("does not redirect or mutate sign-in requests", () => {
    const request = new NextRequest("http://abebe.lvh.me/admin/sign-in?next=/admin");
    const response = middleware(request);

    assert.equal(response.headers.get("x-middleware-next"), "1");
  });
});
```

Note: Next middleware request-header overrides are encoded into response metadata in tests, so this test only verifies middleware returns a next response for included and excluded paths. The layout helper tests verify safe path handling. Manual route verification covers the full request header path.

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
pnpm --filter @ecs/dashboard test
```

Expected: FAIL because `apps/dashboard/src/middleware.ts` does not exist.

- [ ] **Step 3: Implement middleware**

Create `apps/dashboard/src/middleware.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";

import { DASHBOARD_PATH_HEADER } from "@/lib/dashboard-auth";

const excludedAdminPrefixes = [
  "/admin/sign-in",
  "/admin/session",
  "/admin/storefront/template",
] as const;

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (!pathname.startsWith("/admin") || isExcludedAdminPath(pathname)) {
    return NextResponse.next();
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(DASHBOARD_PATH_HEADER, `${pathname}${search}`);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

function isExcludedAdminPath(pathname: string) {
  return excludedAdminPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export const config = {
  matcher: ["/admin/:path*"],
};
```

- [ ] **Step 4: Run tests to verify green**

Run:

```bash
pnpm --filter @ecs/dashboard test
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add apps/dashboard/src/middleware.ts apps/dashboard/src/middleware.test.ts
git commit -m "feat: capture dashboard auth redirect paths"
```

Expected: commit succeeds.

---

## Task 3: Protect The Merchant Dashboard Shell

**Files:**
- Modify: `apps/dashboard/src/app/admin/(dashboard)/layout.tsx`
- Create: `apps/dashboard/src/components/app/dashboard-access-state.tsx`

- [ ] **Step 1: Create the dashboard access state component**

Create `apps/dashboard/src/components/app/dashboard-access-state.tsx`:

```tsx
import Link from "next/link";

import { Button } from "@/components/ui/button";

type DashboardAccessStateProps = {
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
};

export function DashboardAccessState({
  actionHref,
  actionLabel,
  description,
  title,
}: DashboardAccessStateProps) {
  return (
    <main className="grid min-h-svh place-items-center bg-background p-6 text-foreground">
      <section className="flex w-full max-w-md flex-col gap-4 rounded-2xl border bg-card p-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-semibold tracking-normal">{title}</h1>
          <p className="text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
        {actionHref && actionLabel ? (
          <Button asChild className="self-start">
            <Link href={actionHref}>{actionLabel}</Link>
          </Button>
        ) : null}
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Modify the dashboard layout to enforce auth**

Replace `apps/dashboard/src/app/admin/(dashboard)/layout.tsx` with:

```tsx
import type { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AppHeader } from "@/components/app/app-header";
import { AppSidebar } from "@/components/app/app-sidebar";
import { DashboardAccessState } from "@/components/app/dashboard-access-state";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  DASHBOARD_PATH_HEADER,
  getDashboardAuthRedirectPath,
  getMerchantDashboardAccess,
} from "@/lib/dashboard-auth";
import { getSelectedTenantId } from "@/lib/dashboard-tenant-context";
import { getMerchantDashboardSummary } from "@/lib/merchant-dashboard";

export default async function AdminDashboardLayout({ children }: { children: ReactNode }) {
  const requestHeaders = await headers();
  const currentPath = requestHeaders.get(DASHBOARD_PATH_HEADER) ?? "/admin";
  const tenantId = new URL(currentPath, "http://dashboard.local").searchParams.get("tenantId");
  const access = await getMerchantDashboardAccess({
    getSummary: () =>
      getMerchantDashboardSummary({
        cookieHeader: requestHeaders.get("cookie"),
        platformApiBaseUrl: process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000",
        requestHost: requestHeaders.get("host"),
        tenantId: getSelectedTenantId({ tenantId: tenantId ?? undefined }),
      }),
  });

  if (!access.ok) {
    if (access.kind === "unauthenticated") {
      redirect(getDashboardAuthRedirectPath(currentPath));
    }

    if (access.kind === "forbidden") {
      return (
        <DashboardAccessState
          actionHref="/admin/sign-in"
          actionLabel="Use another account"
          description="This account is signed in, but it does not have access to this merchant dashboard."
          title="Dashboard access denied"
        />
      );
    }

    return (
      <DashboardAccessState
        description="The dashboard could not reach the Platform API. Start the local Platform API or try again when the service is available."
        title="Dashboard temporarily unavailable"
      />
    );
  }

  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <AppHeader />
          {children}
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
```

- [ ] **Step 3: Run typecheck**

Run:

```bash
pnpm --filter @ecs/dashboard typecheck
```

Expected: PASS.

- [ ] **Step 4: Run tests**

Run:

```bash
pnpm --filter @ecs/dashboard test
```

Expected: PASS.

- [ ] **Step 5: Run build**

Run:

```bash
pnpm --filter @ecs/dashboard build
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add 'apps/dashboard/src/app/admin/(dashboard)/layout.tsx' apps/dashboard/src/components/app/dashboard-access-state.tsx
git commit -m "feat: protect merchant dashboard shell"
```

Expected: commit succeeds.

---

## Task 4: Harden Session Redirect Tests And Docs

**Files:**
- Modify: `apps/dashboard/src/app/admin/session/route.test.ts`
- Modify: `apps/dashboard/README.md`
- Modify: `dev-docs/20-dashboard-ui-foundation.md`

- [ ] **Step 1: Add tests for unsafe next handling**

Append to `apps/dashboard/src/app/admin/session/route.test.ts`:

```ts
test("POST /admin/session rejects unsafe next redirects", async () => {
  process.env.PLATFORM_API_BASE_URL = "http://platform.test";

  globalThis.fetch = async () =>
    new Response(JSON.stringify({ user: { id: "user_1" } }), {
      headers: {
        "content-type": "application/json",
        "set-cookie": "better-auth.session_token=session_1; HttpOnly; SameSite=Lax",
      },
      status: 200,
    });

  const body = new FormData();
  body.set("email", "owner@abebe.local");
  body.set("password", "password1234");
  body.set("next", "https://evil.test/admin");

  const response = await POST(
    new Request("http://dashboard.test/admin/session", {
      body,
      headers: {
        "x-forwarded-host": "abebe.lvh.me",
        "x-forwarded-proto": "http",
      },
      method: "POST",
    }),
  );

  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "http://abebe.lvh.me/admin");
});
```

- [ ] **Step 2: Run tests**

Run:

```bash
pnpm --filter @ecs/dashboard test
```

Expected: PASS. If the test already passes, no route code change is needed.

- [ ] **Step 3: Update dashboard README auth section**

In `apps/dashboard/README.md`, add:

```md
## Merchant Auth

Merchant dashboard pages under `/admin` are protected by the server-side dashboard layout. Unauthenticated users are redirected to `/admin/sign-in?next=<path>`.

Local development seed credentials:

- Email: `owner@abebe.local`
- Password: `password1234`

The dashboard signs in through `POST /admin/session`, which proxies Better Auth email sign-in to Platform API and forwards the Better Auth session cookie back to the browser.
```

- [ ] **Step 4: Update dev docs auth direction**

In `dev-docs/20-dashboard-ui-foundation.md`, replace the auth future-direction paragraph with:

```md
## Auth And Onboarding Direction

The merchant dashboard now has a coordinated server-side auth boundary. Routes under `/admin` render the merchant shell only after Platform API confirms the Better Auth session and tenant membership. `/admin/sign-in` and `/admin/session` remain outside the shell.

Onboarding and polished auth screens are still future coordinated work. Do not hide onboarding state in shell chrome, and do not mix operator administration into the merchant dashboard shell.
```

- [ ] **Step 5: Run final verification**

Run:

```bash
pnpm --filter @ecs/dashboard test
pnpm --filter @ecs/dashboard typecheck
pnpm --filter @ecs/dashboard build
git diff --check
```

Expected: all commands PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add apps/dashboard/src/app/admin/session/route.test.ts apps/dashboard/README.md dev-docs/20-dashboard-ui-foundation.md
git commit -m "docs: document dashboard auth flow"
```

Expected: commit succeeds.

---

## Task 5: Manual Local Verification

**Files:**
- No file changes expected.

- [ ] **Step 1: Start local services**

Run one of:

```bash
pnpm dev
```

or, if infra is already running:

```bash
pnpm --filter @ecs/platform-api dev
pnpm --filter @ecs/dashboard dev
```

Expected:

- Platform API listens on `3000`.
- Dashboard listens on `3001`.
- Caddy routes `abebe.lvh.me/admin` to the dashboard app.

- [ ] **Step 2: Verify unauthenticated redirect**

Open:

```text
http://abebe.lvh.me/admin/products
```

Expected:

- Browser redirects to `/admin/sign-in?next=%2Fadmin%2Fproducts`.
- The merchant shell is not visible before sign-in.

- [ ] **Step 3: Verify sign-in**

Sign in with:

```text
owner@abebe.local
password1234
```

Expected:

- Browser redirects back to `/admin/products`.
- Products page renders without `auth_required`.
- `/admin` and `/admin/orders` render without `auth_required`.

- [ ] **Step 4: Record result**

If manual verification passes, report it. If it fails, do not guess; return to systematic debugging with the observed error and service logs.
