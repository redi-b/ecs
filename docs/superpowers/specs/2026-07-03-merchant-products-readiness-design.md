# Merchant Products Readiness Design

## Goal

Build the first real merchant dashboard commerce workflow: product management backed by the Platform API and Medusa, with clear setup states when local or tenant commerce is not ready.

## Scope

This slice includes:

- Merchant product list improvements.
- Product create, edit, and detail workflows.
- Commerce readiness states that distinguish missing credentials, missing tenant resources, unavailable backend services, and successful readiness.
- Setup messaging for products and orders when commerce is not ready.
- Verification through focused tests and the existing local commerce smoke script.

This slice does not include:

- A separate platform operations dashboard.
- Full order management UX beyond preserving setup/error states.
- Storefront product presentation.
- Direct dashboard calls to Medusa.
- Secret persistence in repository files.

## Architecture

The dashboard continues to use Platform API as its only commerce boundary. The dashboard must not call Medusa directly or know Medusa credentials.

The Platform API owns:

- Authentication and tenant authorization.
- Tenant-to-commerce context resolution.
- Medusa admin API access.
- Product, category, collection, price, and stock orchestration.
- Normalized commerce errors for dashboard consumption.

The dashboard owns:

- Route-level auth boundary.
- Merchant product UI and form interactions.
- User-facing setup states and retry paths.
- URL/search state for pagination and selected tenant context.

## Commerce Readiness

Product pages need a readiness model that can explain why commerce is unavailable.

Readiness states:

- `ready`: Platform API is reachable, the merchant session is valid, tenant commerce IDs exist, the Medusa admin token is configured, and the relevant Medusa resource calls succeed.
- `auth_required`: the dashboard session is missing or expired. Existing auth redirect behavior should handle this before product content renders.
- `dashboard_forbidden`: the signed-in user is not authorized for the selected tenant.
- `platform_unavailable`: dashboard cannot reach Platform API.
- `commerce_credentials_missing`: Platform API is running without `MEDUSA_ADMIN_API_TOKEN`.
- `commerce_context_missing`: tenant is missing required Medusa IDs such as sales channel, region, publishable key, or stock location where required.
- `commerce_backend_unavailable`: Platform API cannot call the configured commerce backend.
- `commerce_resource_missing`: tenant commerce IDs exist, but Medusa does not return the expected resources.

The UI should avoid raw internal error codes as primary copy. Codes can remain visible in secondary detail only when useful for development.

## Product Workflow

Products becomes a real merchant workflow with these views:

- Product list: table of merchant-scoped products with title, handle, status, variants, price signal if available, stock signal if available, and updated date.
- Product detail: read-only summary of product identity, status, media, categories, collection, variants, price, and stock.
- Create product: form for core product data.
- Edit product: form for updating core product data.

Initial writable fields:

- Title.
- Handle.
- Description.
- Status.
- Thumbnail URL.
- Image URLs.
- Price amount.
- Currency code.
- Collection.
- Categories.

Stock updates are excluded from this slice. Product detail may show read-only stock when the existing stock endpoint returns it, but inventory editing belongs in a separate inventory-focused phase.

## Dashboard UX

When commerce is ready:

- Product list shows table, pagination, and create action.
- Empty list shows an action-oriented empty state with a create-product path.
- Create/edit forms use the existing dashboard shell styling and shadcn primitives.
- Primary actions use consistent hover, focus, loading, and disabled states.
- Mutations redirect back to the product list or detail with a clear result state.

When commerce is not ready:

- Products and orders show setup states instead of destructive alerts.
- The setup state should name the problem in operator terms, for example "Medusa admin token is not configured" instead of only `commerce_credentials_missing`.
- The page should explain the next local action when known, such as starting Platform API with `MEDUSA_ADMIN_API_TOKEN`.
- Retry affordances should reload the current page without losing selected tenant or pagination state.

## Local Development Readiness

Local development remains token-driven:

- Medusa seed creates and prints the local admin API token.
- The developer starts Platform API with `MEDUSA_ADMIN_API_TOKEN=<token>`.
- Platform seed maps `abebe.lvh.me` to the local Medusa commerce resource IDs.

This slice should make failures in that chain obvious. It should not commit generated tokens or write secrets into tracked files.

If local Medusa resource IDs drift from platform seed IDs, the dashboard should show a setup/resource state instead of looking like a broken product page.

## Data Flow

Product list:

1. Dashboard page resolves request cookies, host, pagination, and selected tenant.
2. Dashboard calls Platform API merchant product list endpoint.
3. Platform API authenticates session and authorizes tenant access.
4. Platform API resolves tenant commerce context.
5. Platform API calls Medusa with the configured admin token.
6. Dashboard renders products or a mapped setup state.

Product create/edit:

1. Dashboard form submits to a dashboard route handler or server action.
2. Dashboard route forwards cookies, host, selected tenant, and normalized product input to Platform API.
3. Platform API validates tenant authorization and commerce context.
4. Platform API calls Medusa create/update product APIs.
5. Dashboard redirects with a success or mapped error result.

## Testing

Dashboard tests should cover:

- Product list setup-state mapping for credential, context, backend, and resource errors.
- Product list successful rendering with normalized product data.
- Create/edit request payloads include the supported product fields.
- Mutation redirects preserve selected tenant context.

Platform API tests should cover:

- Readiness/error mapping for missing admin token.
- Tenant commerce context failures.
- Medusa resource-not-found failures if the existing service can distinguish them.
- Product create/update forwarding for fields used by the dashboard forms.

Manual/local verification should include:

- `pnpm --filter @ecs/dashboard test`
- `pnpm --filter @ecs/platform-api test`
- `pnpm --filter @ecs/dashboard typecheck`
- `pnpm --filter @ecs/platform-api typecheck`
- `pnpm smoke:commerce` when Platform API and Medusa are running with a valid `MEDUSA_ADMIN_API_TOKEN`.

## Success Criteria

- A merchant can view products from Medusa through the dashboard.
- A merchant can create and edit a basic product through the dashboard.
- Missing local commerce setup shows a helpful setup state, not raw failure copy.
- The dashboard still never talks to Medusa directly.
- The implementation has automated coverage for readiness mapping and product mutations.
- The existing commerce smoke script remains the end-to-end local verification path.
