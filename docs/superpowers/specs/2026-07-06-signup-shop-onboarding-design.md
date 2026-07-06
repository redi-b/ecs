# Signup And Shop Onboarding Design

## Goal

Build a strict, guided registration and onboarding flow that lets a new merchant create an account, set up a shop, choose a storefront, provision the real backend resources, and enter the merchant dashboard without relying on seeded accounts.

## Product Direction

The flow separates account creation from shop provisioning.

This is intentional. Account creation is an authentication concern, while shop provisioning touches tenant records, platform subdomains, Medusa commerce resources, storefront configuration, membership, onboarding state, and failure recovery. Keeping them separate makes the system easier to recover when provisioning fails and makes future email verification easier to enforce.

The MVP should allow shop creation immediately after signup. Email verification is not a blocking gate for MVP, but the route and state model should allow it to become a gate later.

## References

- Shopify separates initial store setup into guided setup work after the account exists, including products, store settings, theme/customization, payments, and shipping.
- Shopify theme customization is handled as a later admin/editor activity, not overloaded into account creation.
- Medusa admin concepts reinforce that catalog setup should later guide merchants through products, variants, categories, and collections.
- Vendure's channel model reinforces that shop setup needs a real sales boundary, not only UI state.

Reference URLs:

- https://help.shopify.com/en/manual/intro-to-shopify/initial-setup
- https://help.shopify.com/en/manual/online-store/themes/customizing-themes
- https://docs.medusajs.com/user-guide/products
- https://docs.vendure.io/current/core/core-concepts/channels

## User Flow

### 1. Create Account

Route: `/admin/sign-up`

This route lives on the central/system dashboard host, not a shop subdomain.

Fields:

- Full name
- Email
- Password
- Confirm password

Behavior:

- Normalize email to lowercase.
- Validate password locally with the MVP policy before calling auth.
- Confirm password must match.
- Create a Better Auth user and session.
- Redirect to `/admin/onboarding`.
- If the account already exists, show a production-safe message and direct the user to sign in.

Merchant-facing copy should be concise:

- Title: `Create your merchant account`
- Description: `Set up your account first, then create your shop.`
- Secondary action: `Already have an account? Sign in`

### 2. Shop Basics

Route: `/admin/onboarding`

Fields:

- Shop name
- Shop handle/subdomain
- Business category
- Optional contact phone

Behavior:

- Auto-generate the handle from the shop name.
- Let the user edit the handle.
- Show a live address preview: `{handle}.lvh.me`.
- Debounce handle availability checks.
- Block the next step while the handle is invalid, unavailable, or still checking.

Validation:

- Shop name is required and should be 2-80 characters.
- Handle is required.
- Handle must use lowercase letters, numbers, and hyphens.
- Handle cannot start or end with a hyphen.
- Reserved, invalid, and taken handles map to merchant-safe messages.

### 3. Storefront Selection

Route: same wizard at `/admin/onboarding`.

Data source:

- Use real storefront templates from `/platform/storefront/templates`.

UI:

- Template card grid with preview, name, short description, and selected state.
- If there is only one active template, preselect it.
- Continue is disabled until a template is selected.
- If template preview assets are missing, use a polished structured preview component instead of placeholder marketing copy.

Backend:

- Shop provisioning should accept a selected `templateId` or `templateKey`.
- If the backend cannot provision a non-default template yet, implementation must either add support during provisioning or create the shop and immediately call the existing storefront template selection endpoint before redirecting.

### 4. Provisioning

Route: same wizard at `/admin/onboarding`.

Behavior:

- Submit the collected shop and storefront data to platform shop creation.
- Show an optimistic step list while waiting for the backend response:
  - `Creating shop`
  - `Preparing storefront`
  - `Setting up checkout`
  - `Opening dashboard`
- Do not show fake exact percentages.
- Success redirects to the returned dashboard URL, usually `http://{handle}.lvh.me/admin`.

Failure:

- Keep the user in onboarding.
- Show `Shop setup could not be completed`.
- Offer `Try again` and `Edit shop details`.
- If the backend has a retryable provisioning attempt, use the retry route.
- If retry does not apply, resubmit the same wizard data after user confirmation.
- Do not expose raw Medusa, database, or platform error codes in the UI.

### 5. Dashboard Checklist

After shop creation, the user enters the actual shop dashboard on the shop subdomain.

The dashboard should include a compact onboarding checklist:

- Add first product
- Review storefront
- Configure delivery
- Set up payments
- Review shop settings

This checklist is not the blocking signup wizard. It is a post-create operational guide.

## Payment Setup

Payment setup is a known onboarding step but is non-blocking for MVP.

The blocking wizard should not force payment setup before the user reaches the dashboard. Payment provider setup can involve pending review states, missing business details, or external provider issues; blocking dashboard access on that would make signup brittle.

The backend onboarding model should still include `payment_setup` as a stable step name so payments can become stricter later without rewriting the flow.

For MVP:

- Do not include payment setup in the blocking wizard.
- Include `Set up payments` in the dashboard checklist.
- Payment setup can later become required before accepting live paid orders, not before opening the dashboard.

## Routing Model

### Central/System Host

`/admin/sign-up`

- Anonymous users create platform accounts.
- Authenticated users without a shop redirect to `/admin/onboarding`.
- Authenticated users with a shop redirect to their primary shop dashboard.

`/admin/sign-in`

- On the central/system host, this signs into the platform account.
- After sign-in:
  - no tenant: `/admin/onboarding`
  - one tenant: primary shop dashboard
  - multiple tenants later: shop picker

`/admin/onboarding`

- Requires a platform session.
- If no tenant exists, show the blocking setup wizard.
- If latest provisioning failed, show retry/edit state.
- If a tenant exists, redirect to the primary shop dashboard.

### Shop Subdomain

`{handle}.lvh.me/admin`

- Actual merchant dashboard.
- Requires a session and active membership for that shop.
- Existing shop-scoped sign-in behavior remains.

## State Model

The route layer can derive these states:

```ts
type SignupOnboardingState =
  | "anonymous"
  | "account_created_no_shop"
  | "shop_basics"
  | "storefront_selection"
  | "provisioning"
  | "provisioning_failed"
  | "shop_ready"
  | "dashboard_checklist";
```

Backend onboarding steps should use stable names:

```ts
const onboardingSteps = [
  "account_created",
  "shop_basics",
  "storefront_selected",
  "commerce_resources_provisioned",
  "storefront_configured",
  "payment_setup",
  "dashboard_opened",
] as const;
```

Required before dashboard access:

- User account exists.
- Tenant exists.
- User has active membership on the tenant.
- Commerce resources are provisioned.
- Storefront config exists.

Non-blocking for MVP:

- `payment_setup`
- products created
- delivery configured

## Backend Contracts

### Dashboard Sign-up Proxy

Create a dashboard route such as:

- `POST /admin/sign-up/session`

Responsibilities:

- Validate submitted fields.
- Call Better Auth sign-up email endpoint.
- Forward session cookies to the browser.
- Redirect to `/admin/onboarding`.

This should mirror the existing `/admin/session` cookie/origin handling.

### Platform Onboarding State

Add:

- `GET /platform/onboarding/state`

Response:

```ts
{
  user: {
    id: string;
    email: string;
    name: string;
  };
  tenants: Array<{
    id: string;
    name: string;
    handle: string;
    primaryDomain: string | null;
    status: string;
  }>;
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
}
```

Use:

- `/admin/onboarding` decides whether to show the wizard, retry state, or redirect.

### Handle Availability

Add:

- `GET /platform/tenants/handle-availability?handle=...`

Response:

```ts
{
  handle: string;
  available: boolean;
  reason?: "invalid" | "reserved" | "taken";
  hostname?: string;
}
```

Rules:

- Use the same validation as provisioning.
- Check reserved handles.
- Check tenant handle collision.
- Check platform hostname/domain collision.
- Return merchant-safe reasons only.

### Tenant Creation

Extend existing:

- `POST /platform/tenants`

Current body:

```ts
{
  name: string;
  handle: string;
}
```

New body:

```ts
{
  name: string;
  handle: string;
  templateId?: string;
  templateKey?: string;
  businessCategory?: string;
  contactPhone?: string;
}
```

New response:

```ts
{
  tenant: {
    id: string;
    name: string;
    handle: string;
    status: string;
    primaryDomain: {
      hostname: string;
    };
  };
  redirectTo: string;
}
```

Provisioning should use the selected template if one is provided. If no template is provided, it can continue to use the active default template.

Business category and contact phone should not force a schema migration unless the implementation needs them immediately. They can be captured later in shop settings if the MVP does not yet need them for runtime behavior.

### Provisioning Failure

Provisioning failures should record:

- owner user id
- handle
- shop name
- selected template identifier if present
- failed step
- safe internal error code

UI error mapping:

- `handle_unavailable`: handle is no longer available
- `template_unavailable`: selected storefront is no longer available
- `commerce_setup_failed`: shop setup could not finish
- `shop_setup_failed`: shop setup could not finish

Raw errors stay in logs or operator tooling.

## UX And Visual Direction

This is a product setup flow, not a marketing page.

Visual style:

- Full-screen guided flow.
- Calm, premium dashboard style matching the current shadcn foundation.
- No oversized landing hero.
- No decorative blobs or filler illustrations.
- Main focus panel for the current step.
- Compact stepper/progress summary.
- Live preview only where useful, such as the shop address and selected storefront.

Form behavior:

- Preserve entered data on validation errors.
- Inline validation near each field.
- Clear pending state on every submit.
- Back navigation keeps wizard state.
- Do not let signed-in users with no shop access normal dashboard pages.

## Security And Tenancy

- Shop-subdomain sign-in remains membership-scoped.
- Central sign-in can authenticate platform users without requiring an existing shop host.
- Normal dashboard routes require tenant context and membership.
- Users with no tenant are redirected to onboarding.
- A user cannot create a tenant for another user.
- A failed provisioning attempt can only be retried by the owning user.

## Testing Requirements

Backend:

- Sign-up route forwards Better Auth cookies.
- Platform onboarding state returns no-tenant state.
- Platform onboarding state returns tenant redirect state.
- Handle availability validates invalid, reserved, taken, and available handles.
- Tenant creation accepts selected template.
- Tenant creation returns `redirectTo`.
- Provisioning failure returns safe error and records retryable attempt.

Dashboard:

- Sign-up validates required fields and password confirmation.
- Successful signup redirects to onboarding.
- Onboarding redirects existing-shop users to shop dashboard.
- Shop basics validates handle state.
- Storefront step requires a selected template.
- Provisioning success redirects to returned URL.
- Provisioning failure shows retry/edit state.

Verification:

```bash
pnpm --filter @ecs/platform-api test
pnpm --filter @ecs/platform-api typecheck
pnpm --filter @ecs/dashboard test
pnpm --filter @ecs/dashboard typecheck
pnpm --filter @ecs/dashboard build
git diff --check
```

## Implementation Phases

1. Backend state and handle availability endpoints.
2. Sign-up proxy and central sign-in redirect behavior.
3. Tenant creation contract extension with selected template and redirect URL.
4. Onboarding wizard UI.
5. Provisioning retry/failure UI.
6. Dashboard checklist entry point.

