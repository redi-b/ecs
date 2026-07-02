# Dashboard UI Foundation Design

Date: 2026-07-02

## Status

Approved design direction, pending implementation plan.

## Goal

Rebuild `apps/dashboard` from its current placeholder into a clean merchant-first dashboard foundation. The foundation should make future dashboard work obvious, consistent, and difficult to make messy.

This is not a product/order/analytics implementation. It is the base shell, design system, provider setup, navigation model, interaction language, and documentation needed before feature pages grow.

## Product Direction

The dashboard is merchant-first. It should support a single active shop at launch and should not show a fake shop switcher placeholder. Multi-shop switching can be introduced later when the capability exists.

Platform operations may become a separate dashboard app or a separate shell boundary later. The merchant dashboard should not be distorted by platform-operator workflows now.

The dashboard should feel like a polished operations tool: calm, fast, clear, and distinctive. It should be Hero UI-inspired, not a Hero UI clone.

## Architecture

The app remains a Next.js App Router app under `apps/dashboard`.

Planned structure:

```text
apps/dashboard/
  components.json
  src/app/
    layout.tsx
    globals.css
    (dashboard)/
      layout.tsx
      page.tsx
      products/page.tsx
      orders/page.tsx
      editor/page.tsx
      insights/page.tsx
      billing/page.tsx
      settings/page.tsx
  src/components/
    app/
      account-menu.tsx
      app-breadcrumbs.tsx
      app-header.tsx
      app-sidebar.tsx
      command-center.tsx
      icons.ts
      theme-toggle.tsx
    providers/
      app-providers.tsx
      query-provider.tsx
      theme-provider.tsx
    ui/
      shadcn components
  src/features/
    shell/
    products/
    orders/
    editor/
    insights/
    billing/
    settings/
  src/lib/
    api/
      client.ts
      errors.ts
      platform.ts
    navigation.ts
    query-client.ts
    routes.ts
    url-state.ts
    utils.ts
```

Boundaries:

- `src/components/app` owns dashboard chrome and global interaction surfaces.
- `src/components/ui` contains shadcn-owned source and should not contain feature-specific product code.
- `src/features/*` owns feature components, schemas, forms, tables, columns, query keys, and route-specific logic.
- `src/lib/navigation.ts` is the source of truth for sidebar, breadcrumbs, command center navigation, and future page metadata.
- `src/lib/url-state.ts` provides shared parsing and serialization for URL-backed list state.

The root layout should stay server-rendered where possible. Interactive providers should be isolated in client components.

## Shadcn And Visual System

Initialize shadcn inside `apps/dashboard`. Before implementation, verify the current CLI flags for preset handling, `--pointer`, base selection, and icon-library support.

Intended CLI shape:

```bash
pnpm dlx shadcn@latest init --template next --base radix --preset <chosen-code> --pointer
```

If `--pointer` is not supported by the installed CLI, document the mismatch and use the current supported equivalent.

Use official shadcn components first. The shell should be built from shadcn primitives, not custom one-off widgets.

Visual decisions:

- Use a custom blue primary accent, not default Tailwind blue and not heavy navy.
- Use OKLCH CSS variables for color tokens.
- Avoid pure black and pure white. Tint neutrals subtly.
- Keep surfaces soft and precise, with controlled radius and subtle layering.
- Use generous spacing compared with default shadcn.
- Avoid decorative gradients, glassmorphism, and card-heavy dashboard cliches.
- Use semantic tokens instead of raw color classes.
- Use `gap-*`, not `space-*`.
- Keep cards for genuine grouping surfaces only.
- Do not build marketing hero sections inside the dashboard.

Icons:

- Prefer Remix Icon React (`@remixicon/react`) for dashboard-facing navigation and app icons.
- If the shadcn CLI supports Remix as a first-class icon library at implementation time, configure it.
- If not, keep generated shadcn internals compatible with the CLI and expose dashboard-facing icons through `src/components/app/icons.ts`.

## Theme Handling

Use `next-themes` for theme persistence, system preference, and applying the `dark` class.

Own the provider behind a local wrapper:

```tsx
<ThemeProvider attribute="class" defaultTheme="system" enableSystem>
  {children}
</ThemeProvider>
```

The app should not use `disableTransitionOnChange`, because the theme switch should have a custom transition.

Theme transition:

- `next-themes` owns state and hydration.
- `ThemeToggle` owns the visual effect.
- The toggle captures the click position and starts an ink/radial fill transition.
- The theme changes during the transition.
- Reduced motion switches instantly.
- Unsupported browsers fall back to crossfade or instant switch.
- CSS variables should transition consistently enough to avoid a harsh flash.

## Layout And Navigation

Use the official shadcn `sidebar` pattern.

Desktop layout:

```text
SidebarProvider
  AppSidebar
  SidebarInset
    AppHeader
      SidebarTrigger
      Breadcrumbs
      Command trigger
      Page actions slot
      Theme toggle
    Page content
```

Sidebar behavior:

- Expanded by default on desktop.
- Collapsible to icon rail.
- Mobile uses the shadcn sidebar mobile behavior.
- Widths and rail sizing should be constants or tokens, not scattered class strings.
- Start with: Overview, Products, Orders, Storefront Editor, Insights, Billing, Settings.
- Do not include a fake shop switcher.

Account and theme controls:

- Account/profile controls belong in the sidebar footer.
- The primary theme toggle belongs in the header so the animated origin is stable and visible.
- The account menu can later include a theme submenu, but full controls should not be duplicated.

Navigation metadata:

```ts
type AppRoute = {
  id: string
  title: string
  href: string
  icon: RemixIcon
  section: "commerce" | "storefront" | "business" | "system"
  keywords: string[]
  disabled?: boolean
}
```

Breadcrumbs:

- Use shadcn `breadcrumb`.
- Generate from route metadata where practical.
- Keep labels short and operational.
- Collapse sensibly on small screens.

Command center:

- Use shadcn `command` inside `dialog`.
- Open with `Cmd/Ctrl+K`.
- Start with navigation actions only.
- Later support entity search, quick actions, help, docs, recent items, and feature-registered commands.
- Command items should derive from `navigation.ts`.
- Disabled or unavailable features should not be clickable dead ends.

Header:

- Do not make the header a second navigation system.
- Header owns breadcrumbs, command trigger, theme toggle, and page-level action slots.
- Feature pages can provide page actions without changing the shell.

## Data, Query, Tables, Forms

The foundation should establish patterns without pretending the final feature APIs are ready.

TanStack Query:

- Add one query provider under `src/components/providers/query-provider.tsx`.
- Configure conservative defaults.
- Centralize query keys per feature.
- Tenant-scoped queries must include tenant identity once auth and membership exist.
- Mutations should invalidate explicit display queries.
- React Query Devtools may be added in development only.

API client boundary:

- Components and pages should not call `fetch` directly.
- API functions should accept typed input and return parsed or validated output when contracts exist.
- Use `@ecs/contracts` and Zod schemas where possible.
- Normalize errors into UI categories: auth, permission, validation, conflict, not found, rate limit, server, network.

TanStack Table:

- Use TanStack Table for serious list and grid pages.
- URL search params are the source of truth for record-affecting state: page, page size, search, sort, filters, and selected view.
- Presentation-only state can stay local: open row menus, column sizing, temporary selection.
- Avoid a huge generic table abstraction too early.
- Start with a small `DataTableShell` and feature-owned column definitions.
- Assume server-side sorting, filtering, and pagination for products, orders, and insights event lists.

Forms:

- Standardize on TanStack Form, Zod, and shadcn field components.
- Forms live in feature modules, not the shell.
- Shared utilities should map field errors, submit state, dirty state, and server validation errors.
- Use shadcn `Field`, `FieldGroup`, `Input`, `Select`, `Textarea`, `Switch`, `Checkbox`, `Button`, and `Alert`.
- Prefer full pages or focused panels for complex creation flows.
- Use sheets or drawers for small edits only when they improve the workflow.

States:

- Use shadcn `Skeleton` for loading layouts.
- Use shadcn `Empty` for true empty states.
- Use `Alert` for actionable errors.
- Never show an empty state while a query is still loading.

## Motion And UX Details

Motion should feel consistent across the dashboard and should never slow the operator down.

Rules:

- Define shared duration and easing tokens.
- Hover and focus transitions should be around 120-180ms.
- Overlays should be around 180-240ms.
- Use ease-out curves, no bounce or elastic motion.
- Animate opacity, transform, color, and overlay masks.
- Avoid layout-property animations except where shadcn sidebar behavior already handles them.
- Respect `prefers-reduced-motion`.

Apply consistent transitions to:

- sidebar expand/collapse
- mobile sidebar drawer
- sheets
- dialogs
- dropdowns
- popovers
- command center
- tabs
- accordions
- toasts
- menus

Use shadcn and Radix state attributes such as `data-state`, `data-side`, and `data-collapsible` where possible.

Interaction details:

- Icon-only buttons need accessible labels and tooltips when meaning is not obvious.
- Focus rings should be visible and use the blue ring token.
- Sidebar active state should be clear but not loud.
- Command center should show keyboard shortcuts only when they are real.
- Header and sidebar should remain stable across loading states.
- Destructive actions require confirmation and clear copy.
- Long-running actions need disabled submit states and visible feedback.
- Toasts should be reserved for background confirmations, not primary error handling.

Responsive behavior:

- Desktop: sidebar, header, content.
- Tablet: collapsible sidebar, tighter gutters.
- Mobile: sidebar drawer, collapsed breadcrumbs, command center accessible, page actions move into menus when needed.
- Tables need per-feature responsive strategies: priority columns, horizontal scroll, or mobile list views depending on density.

Accessibility:

- Prefer shadcn primitives because they provide accessible structure.
- Dialog, sheet, and drawer content always need titles.
- Color cannot be the only status indicator.
- Keyboard navigation must work for command center, menus, sidebar, and forms.

## Implementation Phases

### Phase 1: Clean Foundation

- Remove placeholder page styling.
- Initialize shadcn in `apps/dashboard`.
- Verify shadcn CLI flags before applying.
- Choose or generate the custom preset direction.
- Add dependencies:
  - `next-themes`
  - `@remixicon/react`
  - `@tanstack/react-form`
  - optionally `@tanstack/react-query-devtools` as dev-only
- Keep existing `@tanstack/react-query`, `@tanstack/react-table`, `recharts`, and `zod`.

### Phase 2: Shell Components

Install only immediately needed shadcn components first:

```text
sidebar
breadcrumb
command
dialog
dropdown-menu
separator
sheet
tooltip
button
avatar
badge
skeleton
empty
alert
scroll-area
input
field
```

Add later only when needed:

```text
table
select
textarea
switch
checkbox
tabs
popover
drawer
sonner
```

### Phase 3: App Structure

Create provider, app chrome, navigation, URL state, query, and API boundary files. Add empty route pages for the initial nav sections.

### Phase 4: Shell UI

Build:

- `AppProviders`
- `QueryProvider`
- `ThemeProvider`
- `AppSidebar`
- `AppHeader`
- `AppBreadcrumbs`
- `CommandCenter`
- `ThemeToggle`
- `AccountMenu`
- merchant-first overview page
- empty route pages for Products, Orders, Editor, Insights, Billing, Settings

### Phase 5: Quality Checks

Run:

```bash
pnpm --filter @ecs/dashboard typecheck
pnpm --filter @ecs/dashboard build
```

Visual QA after implementation:

- desktop screenshot
- mobile screenshot
- light and dark screenshots
- sidebar expanded and collapsed
- command center open
- dropdown and sheet open
- theme transition sanity check
- no overlapping text
- no broken hydration

### Phase 6: Documentation

Add dashboard documentation:

```text
apps/dashboard/README.md
dev-docs/20-dashboard-ui-foundation.md
```

Document:

- visual principles
- shadcn preset and config choices
- component ownership boundaries
- navigation metadata pattern
- data, query, table, and form rules
- motion and theme rules
- how to add a new dashboard feature page

## Explicit Non-Goals

- Do not implement real product, order, editor, insights, billing, or settings workflows in this foundation pass.
- Do not introduce a fake shop switcher.
- Do not build platform-operator workflows into this merchant shell.
- Do not create a broad generic table abstraction before feature needs prove it.
- Do not use mock metrics or fake operational data as if they are real.

## Open Implementation Checks

- Confirm exact shadcn CLI support for `--pointer`.
- Confirm exact shadcn preset code or custom registry item to apply.
- Confirm whether the CLI can configure Remix icons directly.
- Confirm final blue OKLCH values against light and dark contrast.
- Confirm whether React Query Devtools should be installed in the first pass.
