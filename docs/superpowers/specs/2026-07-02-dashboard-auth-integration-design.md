# Dashboard Auth Integration Design

Date: 2026-07-02

## Status

Approved design direction, pending implementation plan.

## Goal

Add a correct merchant dashboard authentication boundary so unauthenticated users are sent to sign in before the merchant shell renders, while authenticated merchant users can reach the dashboard pages without seeing raw Platform API auth errors.

## Scope

This work covers the merchant dashboard auth/session flow only.

In scope:

- Protect `/admin` and all routes under `apps/dashboard/src/app/admin/(dashboard)`.
- Keep `/admin/sign-in` outside the merchant shell.
- Keep `/admin/session` as the dashboard-owned POST endpoint that signs in through Platform API Better Auth.
- Redirect unauthenticated dashboard requests to `/admin/sign-in?next=<safe-dashboard-path>`.
- Preserve the requested path through sign-in and return the merchant there after successful authentication.
- Convert Platform API auth and permission failures into intentional dashboard states.
- Keep network/service failures visible as service-unavailable states.
- Add tests around redirect decisions, safe `next` handling, and cookie forwarding.

Out of scope:

- A polished auth/onboarding visual redesign.
- Multi-shop switching.
- Operator dashboard auth.
- Password reset, invitation, account recovery, social login, or MFA.
- Replacing Better Auth.
- Moving product mutation route handlers.

## Current State

The dashboard has the pieces of an auth flow but no central dashboard boundary.

- `apps/dashboard/src/app/admin/sign-in/page.tsx` renders a basic sign-in form outside the merchant shell.
- `apps/dashboard/src/app/admin/session/route.ts` submits email and password to Platform API Better Auth at `/platform/auth/sign-in/email`.
- Platform seed creates the local owner user:
  - email: `owner@abebe.local`
  - password: `password1234`
- Platform API correctly returns `auth_required` for merchant dashboard API calls without a Better Auth session cookie.
- The new dashboard overview, product, and order pages currently call merchant Platform API helpers directly. When unauthenticated, they render error alerts such as `auth_required` instead of redirecting to sign-in.

## Design

Add a server-side auth boundary for the merchant dashboard shell.

The boundary should run before `AppSidebar`, `AppHeader`, and page content render. It should call the existing merchant dashboard summary helper because that endpoint already verifies all required pieces:

- Better Auth session cookie exists and is valid.
- Host resolves to a tenant.
- Signed-in user is authorized for that tenant.
- Tenant, actor, commerce, and storefront summary can be loaded.

The guard result should be explicit:

```ts
type MerchantDashboardAccess =
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
```

The dashboard layout should handle these states:

- `ok: true`: render the shell and children.
- `unauthenticated`: redirect to `/admin/sign-in?next=<current path>`.
- `forbidden`: render an access-denied page inside the app boundary or a minimal non-shell dashboard error surface.
- `unavailable`: render a service-unavailable page or alert that makes it clear Platform API is not reachable.

`auth_required` must not be shown as page content.

## Routing And Redirects

The protected route group remains:

```text
apps/dashboard/src/app/admin/(dashboard)
```

Sign-in remains:

```text
apps/dashboard/src/app/admin/sign-in/page.tsx
```

Session POST remains:

```text
apps/dashboard/src/app/admin/session/route.ts
```

The redirect target must be safe:

- allowed: `/admin`, `/admin/products`, `/admin/orders?page=2`
- rejected: `https://external.test`, `//external.test`, empty values

Rejected values should fall back to `/admin`.

The guard should preserve the current path and query string as `next`, except for unsafe paths. Use dashboard middleware to attach the original pathname and search string to protected dashboard requests through an internal request header. The layout-level guard reads that header and builds the safe sign-in redirect.

## Data Flow

Unauthenticated user:

```text
GET /admin/products
  -> dashboard auth boundary calls Platform API with request cookies and host
  -> Platform API returns 401 { error: "auth_required" }
  -> dashboard redirects to /admin/sign-in?next=/admin/products
  -> user submits /admin/session
  -> dashboard proxies Better Auth sign-in to Platform API
  -> dashboard forwards set-cookie headers
  -> dashboard redirects to /admin/products
```

Authenticated user:

```text
GET /admin/products
  -> dashboard auth boundary calls Platform API with request cookies and host
  -> Platform API returns merchant dashboard summary
  -> dashboard shell renders
  -> page loads product list with the same request cookies and host
```

Forbidden user:

```text
GET /admin/products
  -> Platform API returns 403 { error: "dashboard_forbidden" }
  -> dashboard renders a clear access-denied state
```

Service unavailable:

```text
GET /admin/products
  -> Platform API cannot be reached
  -> dashboard renders a service-unavailable state
```

## Error Handling

Map Platform API failures into dashboard-level states:

| Platform result | Dashboard behavior |
| --- | --- |
| `auth_required` with status 401 | redirect to sign-in |
| `dashboard_forbidden` with status 403 | access-denied state |
| host/tenant errors | dashboard error state with readable copy |
| `platform_request_failed` | service-unavailable state |
| invalid response | service-unavailable state |

The Platform API remains the source of truth for auth and authorization. The dashboard should not infer tenant membership locally.

## UI Direction

This slice should not redesign auth pages.

Allowed UI changes:

- Replace raw API error strings on protected pages with intentional redirect or dashboard-level error states.
- Improve sign-in copy only if needed for correctness, such as showing the local test account in development.
- Keep auth controls outside the merchant shell.

Deferred UI work:

- Polished sign-in page.
- Onboarding screens.
- Account recovery and invitation flows.

## Testing

Use TDD for behavior changes.

Tests should cover:

- `auth_required` from merchant summary becomes `unauthenticated`.
- `dashboard_forbidden` becomes `forbidden`.
- `platform_request_failed` becomes `unavailable`.
- safe `next` paths are preserved.
- unsafe `next` values are rejected.
- `/admin/session` still forwards Better Auth cookies.
- successful sign-in redirects to safe `next`.

Verification commands:

```bash
pnpm --filter @ecs/dashboard test
pnpm --filter @ecs/dashboard typecheck
pnpm --filter @ecs/dashboard build
```

Manual local verification:

1. Start local infra and apps with `pnpm dev` or start Platform API and dashboard explicitly.
2. Open `http://abebe.lvh.me/admin`.
3. Confirm the page redirects to `/admin/sign-in?next=/admin`.
4. Sign in with `owner@abebe.local` and `password1234`.
5. Confirm `/admin`, `/admin/products`, and `/admin/orders` load without `auth_required`.

## Implementation Decision

Use middleware for `next` path reconstruction.

Reason: Next.js App Router layouts do not receive `searchParams`, and `headers()` is the reliable server boundary available to a layout. Middleware can add an internal header for `/admin` dashboard routes while excluding `/admin/sign-in`, `/admin/session`, and other route handlers that must remain outside the merchant shell guard.
