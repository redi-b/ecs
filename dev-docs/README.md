# ECS Development Docs

This folder contains the implementation reference for the Ethiopian merchant commerce platform.

These docs are intentionally local/dev-only and are excluded from git tracking through `.git/info/exclude`.

## Document Order

1. `01-system-definition.md`
2. `02-architecture-decisions.md`
3. `03-system-architecture.md`
4. `04-domain-model.md`
5. `05-platform-api.md`
6. `06-medusa-integration.md`
7. `07-storefront-routing.md`
8. `08-dashboard-and-editor.md`
9. `09-payments-and-delivery.md`
10. `10-tenancy-security.md`
11. `11-deployment-and-routing.md`
12. `12-testing-maintenance-upgrades.md`
13. `13-agent-development-guide.md`
14. `14-notifications.md`
15. `15-billing-and-plans.md`
16. `16-project-structure-tooling.md`
17. `17-insights-and-analytics.md`
18. `18-platform-db-and-dev-workflow.md`
19. `19-storefront-template-system.md`
20. `20-dashboard-ui-foundation.md`

## Current Locked Direction

- Medusa is the commerce engine.
- The project is a pnpm TypeScript monorepo using Turbo and Biome.
- Platform DB uses Drizzle ORM, Drizzle Kit migrations, and PostgreSQL.
- Platform API is separate from Medusa and built with Hono unless implementation findings force a change.
- Merchants do not access Medusa Admin.
- The merchant dashboard is a custom Next.js app using shadcn/ui.
- Dashboard data fetching/tables/forms should use TanStack libraries where they fit.
- Dashboard charts should use shadcn/ui chart components with Recharts.
- Storefront is a custom multi-tenant app, initially suitable for Astro SSR plus caching.
- Public storefront/API traffic resolves tenant from host whenever possible.
- Medusa is not exposed directly. Public Store API behavior goes through a transparent `/store/*` facade.
- Platform state lives outside Medusa.
- Commerce state lives in Medusa.
- One tenant maps to one Medusa Store and one primary Sales Channel initially.
- Puck is used as an inline template content editor first, not as an unconstrained page builder.
- Storefront templates use shared manifests/defaults, Astro renderers, dashboard editor adapters, and database-backed merchant revisions.
- Caddy is the preferred reverse proxy for Compose-first deployment.
- Notifications are platform-owned, with Medusa event integration where commerce events are the trigger.
- Plans/subscriptions are platform-owned, not delegated to Medusa.
- Insights are platform-owned. Start with Postgres events and daily aggregates, not a separate analytics warehouse.
- `pnpm dev` should orchestrate infra, migrations, seeds, and named service logs.

## Implementation Rule

Do not fork or patch Medusa core unless the team explicitly approves it. Use Medusa modules, links, workflows, providers, custom routes, and documented extension points.
