# Advanced Command Center — Research & Design

Date: 2026-07-15  
Status: design draft (ready to grill / implement after review)  
Supersedes: 2026-07-08 stub in the same path

## Purpose

Upgrade the merchant dashboard **command center** from **navigation-only** (`cmdk` + `getNavigableAppRoutes`) into a fast, keyboard-first control plane:

1. Jump to pages  
2. Find resources (products, orders, customers, …)  
3. Run common **create/open** actions  
4. Resume **recent** work  

It stays an **accelerator**, not a second app. Every destination remains reachable via sidebar/pages.

## Current state (as of 2026-07-15)

| Piece | Today |
|-------|--------|
| UI | `apps/dashboard/src/components/app/command-center.tsx` — Dialog + shadcn Command / `cmdk` |
| Open | Header search control + **Ctrl/Cmd+K** |
| Results | Static **Navigation** group only |
| Data | `getNavigableAppRoutes()` from `navigation.ts` (includes children like Categories/Collections) |
| Missing from palette | Settings/Billing are in `appRoutes` (account section) — **included** via navigable helper |
| Not in palette | Notification center (bell), theme, account menu actions, deep resource links |
| Search APIs | Per-resource `q` on products, orders, customers, media, promotions, taxonomy — **no** aggregated `/search` |
| Auth model | Layout shell + tenant membership; no fine-grained capability matrix for command filtering yet |
| i18n | Dashboard localization foundation in progress; command labels should use keys when we touch the surface |

Post-MVP plan placed this track **last** (after media, customers, promotions, notifications, billing, import/export) because resource search needs those resources. **Those resources largely exist now** — so this track is unblocked for implementation planning.

## Product decisions (proposed — grill before build)

| # | Decision | Recommendation |
|---|----------|----------------|
| D1 | Keep `cmdk` / current Dialog shell | **Yes** — adequate; upgrade data layer, not rewrite UI system |
| D2 | Call Platform API only | **Yes** — never Medusa Admin from browser |
| D3 | Aggregated search vs N parallel list calls | **v1: one Platform endpoint** that fans out server-side (debounced client). Avoid 5–7 browser round-trips |
| D4 | First remote types | **products, orders, customers** (highest daily use). Phase-2: media, categories, collections, promotions |
| D5 | Actions = navigate, not mutate | **Yes** for v1 — open create pages/dialogs via URL/query (`?create=1`) or known routes |
| D6 | Recent items storage | **localStorage per shop (tenant id)** first; server-side later if multi-device matters |
| D7 | Permissions | Hide commands merchant cannot use; v1 = **auth + feature presence** (no capability matrix yet). Revisit when roles expand |
| D8 | Empty query | Show **Actions** + **Recent** (and maybe pinned Navigation). Remote search only after ≥2 chars |
| D9 | Min query length | **2** characters for remote search |
| D10 | Result limit | **5–8 per type**, hard cap ~24 total |
| D11 | Tenant scoping | Always current shop (host or `tenantId`); no cross-tenant |
| D12 | AI / NL | **Out of scope** |

## User experience

### Interaction model

```
Ctrl/Cmd+K → open palette
  query empty  → Recent · Actions · (optional) Navigation shortcuts
  query local  → filter static commands immediately
  query ≥ 2    → debounce 200–300ms → GET merchant search
  ↑↓ Enter Esc → standard cmdk
```

### Result groups (stable order)

1. **Actions** — verb-first create/open  
2. **Products**  
3. **Orders**  
4. **Customers**  
5. **More** (media, categories, collections, promotions — when type enabled)  
6. **Navigation** — pages (fallback when name matches)

Empty remote + no local match → “No results” with hint to clear query or open Products/Orders.

### Row content (compact)

| Type | Primary | Secondary |
|------|---------|-----------|
| Product | Title | Handle · status |
| Order | `#displayId` | Customer · payment/fulfillment |
| Customer | Name or email | Email/phone |
| Media | Filename | mime · size optional |
| Action | “Create product” | — |
| Nav | Page title | Section optional |

Icons: reuse `AppIcons` via command registry (no ad-hoc Remix imports).

### Copy principles

- Verb-first actions: “Create product”, “Upload media”, “Open billing”  
- No long descriptions  
- Status as short badge text, not paragraphs  
- English + Amharic keys when implementing (shell already bilingual-ready)

## Architecture

### Layers

```text
CommandCenter (UI orchestration)
  ├── command-registry.ts     // static nav + actions (typed)
  ├── useCommandSearch()      // debounce + query client
  ├── recent-store.ts         // localStorage keyed by tenantId
  └── Platform GET .../search // aggregated remote results
```

### Static command registry

```ts
type CommandDef = {
  id: string;
  label: string;           // or i18n key
  keywords: string[];
  group: "navigation" | "action";
  icon: AppIcon;
  href?: string;           // navigate
  // optional: openCreate?: "product" | "order" | ...
  section?: AppRouteSection;
  disabled?: boolean;
};
```

- **Navigation commands**: derived from `appRoutes` / `getNavigableAppRoutes` so sidebar and palette cannot drift  
- **Action commands**: explicit list next to create routes in `dashboardRoutes`  

### Platform search endpoint

**Recommended path** (matches existing merchant surface):

```http
GET /platform/merchant/search?q=&limit=6&types=product,order,customer
```

Tenant path variant if needed later:

```http
GET /platform/tenants/:tenantId/search?...
```

**Server behavior:**

1. Auth + authorize tenant  
2. Parse `q` (min length 2), `types`, per-type limit  
3. `Promise.all` existing list services with small limits (no new Medusa query language)  
4. Map to **normalized** results with **safe hrefs** from a server route map (or type + id for client map — prefer server hrefs under `/admin/...` consistent with dashboard)  

Note: hrefs are dashboard paths; platform can return `resourceType` + `resourceId` and let the dashboard map via `dashboardRoutes` to avoid hardcoding admin paths in platform-api. **Prefer client-side href mapping** from type+id so platform stays UI-agnostic.

Normalized item:

```ts
type MerchantSearchHit = {
  id: string;
  type: "product" | "order" | "customer" | "media" | "category" | "collection" | "promotion";
  label: string;
  description: string | null;
  status: string | null;
  // client maps type+id → href
};
```

### Contracts

Add to `@ecs/contracts`:

- `merchantSearchQuerySchema`  
- `merchantSearchResponseSchema`  
- types exported for dashboard  

### Dashboard client

- `getMerchantSearch({ q, types, limit, tenantId, cookie })`  
- TanStack Query with key `["merchant-search", tenantId, q, types]`  
- Debounce in the command UI, not only in Query  

### Recent items

```ts
type RecentCommandItem = {
  id: string; // type:resourceId or command id
  kind: "resource" | "command";
  type?: MerchantSearchHit["type"];
  label: string;
  href?: string;
  at: number;
};
```

- Cap 12–15, MRU  
- Key: `ecs.command-recent.v1:${tenantId}`  
- Update on select (resource or action)  
- Empty query only  

## Implementation phases

### Phase 0 — Prep (½ day)

- Typed registry + derive nav from `navigation.ts`  
- Group headings, empty state polish  
- Tests: registry completeness vs navigable routes  

### Phase 1 — Static actions (½–1 day)

- Actions: create product, categories/collections new, customers (if create exists), manual order, media, promotions, open settings/billing  
- Wire via `router.push` to existing create routes  
- Hide disabled routes  

### Phase 2 — Global search API (1–2 days)

- Platform `GET .../search` for product + order + customer  
- Contracts + tests (tenant isolation, empty q, limits)  
- Dashboard remote group rendering + debounce + loading  

### Phase 3 — More types + recent (1 day)

- media, category, collection, promotion  
- localStorage recent items  
- Empty-query recent panel  

### Phase 4 — Polish (½–1 day)

- Keyboard hints, stable group order  
- Amharic strings for registry labels  
- Optional: badge for unpaid invoice “Pay open invoice” action if billing status cheap enough (access shell has no billing — either skip or one tiny billing status call; prefer **navigate to Billing** only)  

**Out of first release:** import/export jobs, billing invoice search, favorites, server recent, AI.

## Security

- Tenant-scoped search only  
- Same auth as list endpoints  
- No extra PII fields beyond list rows  
- No destructive commands  
- Rate: natural debounce + small limits; optional platform rate limit later  

## Testing

### Platform

- Authorized tenant gets own products/orders/customers only  
- Short query returns empty or 400 consistently (prefer empty results if `q.length < 2`)  
- Type filter excludes other types  
- Limit respected  

### Dashboard

- Ctrl/Cmd+K toggle  
- Local filter works offline  
- Loading / empty / error for remote  
- Select product → detail route  
- Action → create route  
- Recent appears after selection  

## Open items for grill

1. **Href ownership**: client map vs platform absolute admin paths? *(Rec: client map)*  
2. **Order “detail”**: confirm `dashboardRoutes.orderDetail` is the right jump target for all order hits  
3. **Create product**: full page vs sheet — command should match current products UX  
4. **Role filtering**: owner/manager/staff — any action staff must not see today?  
5. **Shortcut on non-Latin layouts**: keep Ctrl/Cmd+K; document in help  
6. **Should Billing/Settings stay in nav group** when already in account menu? *(Rec: yes, for keyboard users)*  

## Success criteria

- Merchant can open palette and reach any primary page without the mouse  
- Typing a product title/SKU or order # finds it in under ~300ms after debounce (local network)  
- Create product/order/customer from palette without hunting sidebar  
- No regressions to header layout or mobile icon trigger  
- No Medusa Admin calls from the browser  

## References

- UI: `apps/dashboard/src/components/app/command-center.tsx`  
- Nav: `apps/dashboard/src/lib/navigation.ts`, `routes.ts`  
- List clients: `merchant-customers.ts`, `platform-api/products`, `platform-api/orders`, `merchant-media.ts`, `merchant-promotions.ts`  
- Parent plan: `dev-docs/21-post-mvp-feature-research-and-plan.md` (track “Advanced command center”)  
- Prior brief: same file, 2026-07-08 stub  

## Suggested next step

Grill decisions D1–D12 and open items, then implement **Phase 0–2** as one PR stack (registry → search API → wire UI). Phase 3 can follow immediately once the three core types feel solid.
