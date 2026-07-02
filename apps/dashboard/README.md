# Dashboard

Merchant-first Next.js dashboard for ECS shops.

## Foundation Rules

- Use shadcn/ui as the primary component system. Generated shadcn source lives under `src/components/ui`.
- Keep merchant shell chrome and global dashboard interaction surfaces under `src/components/app`.
- Put feature-specific code under `src/features/*`, including feature components, schemas, query keys, table columns, forms, and route-specific logic.
- Use Remix Icon React for dashboard-facing icons through `src/components/app/icons.ts`. Do not import icon packages ad hoc across feature code.
- Use `next-themes` only through the local provider wrapper in `src/components/providers/theme-provider.tsx`.
- Use TanStack Query for server state, TanStack Table for data-heavy tables, TanStack Form for complex forms, and Zod for validation schemas and typed parsing.
- List and table state that affects shareable views must be backed by the URL through shared parsing/serialization helpers.
- Do not add a fake shop switcher. The dashboard starts with one active shop until real multi-shop capability exists.
- Do not build auth, onboarding, or operator workflows into the merchant shell foundation. Treat those as future coordinated product and platform work.

## Routing And Ownership

- Dashboard shell routes live under `src/app/admin/(dashboard)` and render at `/admin/*`.
- `/admin/sign-in` lives outside the dashboard shell.
- API route handlers under `src/app/admin/**/route.ts` are not shell pages.
- `src/lib/navigation.ts` is the source of truth for sidebar, breadcrumb, command-center, and future page metadata.

## Verification

Run targeted checks before committing dashboard foundation changes:

```bash
pnpm --filter @ecs/dashboard typecheck
```

Use a full dashboard build only when the change touches runtime code, dependencies, Next.js routing behavior, or generated component source:

```bash
pnpm --filter @ecs/dashboard build
```
