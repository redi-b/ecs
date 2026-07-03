# Dashboard UI Foundation

## Scope

The dashboard foundation is the merchant-first shell for ECS shops. It provides app chrome, route structure, navigation metadata, providers, visual-system rules, and implementation conventions for future dashboard features.

This foundation does not implement product management, order operations, analytics workflows, auth, onboarding, or operator administration. Those workflows must be added as coordinated feature work with their own routes, data contracts, and verification.

## Routing

Dashboard pages render under `/admin/*`.

- `apps/dashboard/src/app/admin/(dashboard)/layout.tsx` owns the merchant shell layout.
- `apps/dashboard/src/app/admin/(dashboard)/page.tsx` renders `/admin`.
- Feature shell placeholders currently live under `apps/dashboard/src/app/admin/(dashboard)`, including products, orders, editor, insights, billing, and settings.
- `/admin/sign-in` lives at `apps/dashboard/src/app/admin/sign-in/page.tsx` and is outside the merchant shell.
- API route handlers under `apps/dashboard/src/app/admin/**/route.ts` are backend-facing route handlers, not dashboard shell pages.

## Shell Boundaries

- `src/components/app` owns dashboard chrome: sidebar, header, breadcrumbs, command center, account menu, page shell, icon exports, and theme toggle.
- `src/components/ui` contains shadcn/ui source. Keep it generic and do not add feature-specific product code there.
- `src/components/providers` owns client provider wrappers for theme and query state.
- `src/features/*` is where feature-specific UI and logic belongs as pages grow.
- `src/lib/navigation.ts` is the shared source of truth for sidebar links, breadcrumbs, command-center navigation, and future route metadata.
- `src/lib/url-state.ts` owns shared URL parsing and serialization helpers for list and table state.

## Navigation

The first dashboard navigation is intentionally flat: Overview, Products, Orders, Storefront Editor, Insights, Billing, and Settings.

Do not add a fake shop switcher. Multi-shop switching should appear only when the platform has real multi-shop capability and a coordinated data model.

Navigation metadata may support future `children`, but the shell should only render nested navigation for implemented child routes. The header is not a second navigation system; it owns breadcrumbs, command trigger, theme toggle, and page-level action slots.

## Visual System

Use shadcn/ui as the primary component system. Prefer official shadcn primitives before creating new dashboard primitives.

Use the project visual language consistently:

- OKLCH CSS variables and semantic tokens.
- Custom blue primary accent and ring tokens.
- Tinted neutral backgrounds instead of pure white or pure black.
- Controlled radius, subtle layering, and generous operational spacing.
- `gap-*` utilities instead of `space-*`.
- Cards only for genuine grouping surfaces.
- No decorative gradients, glassmorphism, marketing heroes, or card-heavy dashboard filler.

Dashboard-facing icons must come from Remix Icon React through `src/components/app/icons.ts`. Keep shadcn-generated internals compatible with the shadcn CLI.

## Theme Handling

`next-themes` owns theme persistence, system preference, hydration behavior, and the `dark` class. Use it through the local wrapper in `src/components/providers/theme-provider.tsx`.

The app should not use `disableTransitionOnChange`. Theme switching is a dashboard interaction owned by `ThemeToggle`, which captures the click origin for the radial transition. Reduced-motion users should receive an instant switch, and unsupported browsers should fall back gracefully.

## Data, Query, Table, And Form Patterns

Use TanStack Query for server state. Query keys should be feature-owned, stable, and invalidated at the display-query boundary after mutations.

Use TanStack Table for data-heavy tables. Table state that changes a shareable list view, including pagination, sorting, search, and filters, should be encoded in the URL through shared helpers rather than held only in local component state.

Use TanStack Form for complex forms and Zod for validation, typed parsing, and schema-backed constraints. Feature code should own its schemas and form definitions under `src/features/*` unless a contract is shared across applications.

## Auth And Onboarding Direction

The merchant dashboard now has a coordinated server-side auth boundary. Routes under `/admin` render the merchant shell only after Platform API confirms the Better Auth session and tenant membership. `/admin/sign-in` and `/admin/session` remain outside the shell.

Onboarding and polished auth screens are still future coordinated work. Do not hide onboarding state in shell chrome, and do not mix operator administration into the merchant dashboard shell.

## Manual Visual QA

The preferred final visual QA for this foundation is manual. Before approving visual changes, inspect:

- Desktop expanded sidebar.
- Desktop icon-rail collapsed sidebar.
- Mobile sidebar behavior.
- Breadcrumb and command-center behavior.
- Light, dark, and system theme modes.
- Theme transition behavior with normal and reduced-motion settings.
- `/admin/sign-in` outside the shell.

Run targeted automated verification before committing docs or shell foundation changes:

```bash
pnpm --filter @ecs/dashboard typecheck
```
