# Add a storefront template

ECS storefront templates define presentation and editable content while sharing the platform's
catalogue, cart, checkout, customer account, payment, fulfilment, and order behavior. A template is
not a separate commerce application.

Use this guide when preparing a new production template or a new major version of an existing one.

## Before you begin

You will need:

- a complete visual design for desktop and mobile;
- approved fonts, images, icons, and their usage rights;
- the template name, public description, slug, and version;
- representative products and collections for testing; and
- Node.js 22 or newer with pnpm installed through the repository setup.

Do not publish placeholder designs. A template enters the public catalogue only after its complete
customer journey and merchant editor experience pass review.

## How templates are organised

A template has two coordinated parts:

| Location | Responsibility |
| --- | --- |
| `packages/storefront-templates/src/templates/<slug>/v<version>` | Validated content schema, theme schema, defaults, and merchant editor manifest |
| `apps/storefront/src/templates/<slug>/v<version>` | Astro renderers, styles, browser interactions, icons, and bundled visual assets |

The stable key uses `<slug>@<version>`, for example `luvia@1`. Treat this key as permanent after the
template has been used by a merchant. Breaking schema or rendering changes require a new version;
small compatible fixes may remain within the current version.

## 1. Define the content and theme contracts

Create the package directory and add:

- `schema.ts` for the Zod content and theme schemas;
- `defaults.ts` for complete, polished default content and theme tokens; and
- `editor.ts` for the fields merchants can change.

Defaults must parse through their schemas without repair. Prefer explicit objects and bounded
arrays. Do not place business records, API identifiers, credentials, or environment-specific URLs in
template defaults.

Every editor field needs a stable data path, unique form property, audience-facing label, and one of
the supported field kinds:

```text
text, textarea, image, link, color, boolean,
collection, collections, product, products, links
```

Use product and collection field kinds when a section refers to the merchant's real catalogue. Use
the image field kind for media-library assets. If a persisted field is replaced, list its previous
paths in `deprecatedPaths` so saving the replacement removes obsolete data safely.

Register the editor manifest in:

```text
packages/storefront-templates/src/editor/registry.ts
```

Export the new schema, defaults, and editor manifest from:

```text
packages/storefront-templates/src/index.ts
```

## 2. Register the template definition

Add one entry to `packages/storefront-templates/src/registry.ts` with:

- stable template and version UUIDs;
- public slug, name, and concise description;
- positive integer version and matching template key;
- schema and theme schema;
- complete default data and theme tokens;
- component registry version and source hash; and
- availability.

Keep availability non-selectable until the final release review. Changing the registry alone does
not make an unfinished design acceptable for merchants.

The registry is synchronized into the Platform database during deployment. For local development,
run:

```bash
pnpm --filter @ecs/platform-api sync:storefront-templates
```

## 3. Build the storefront renderers

Create `apps/storefront/src/templates/<slug>/v<version>` and implement `Home.astro`. Register it under
the exact template key in `apps/storefront/src/templates/registry.ts`.

The following buyer journey has shared fallbacks, but a production template should provide its own
versions whenever the generic experience would break its visual system:

- product listing;
- product detail;
- cart;
- checkout; and
- order confirmation.

Templates may also provide About, Contact, Request Item, Wishlist, Account, and Account Order pages.
Stable public route files remain in `apps/storefront/src/pages`; template components must not create
competing route trees.

Use the types and functions in `apps/storefront/src/lib/commerce` for catalogue, cart, checkout, and
customer data. Do not call Medusa directly, fetch private admin APIs, or copy commerce rules into a
template. All public commerce requests stay behind the tenant-aware Store API facade.

Mount the shared `StorefrontAnalytics` component once in the template layout. Disable it in editor
and fixture-demo modes. Do not create template-specific analytics calls or session storage: the
shared component records the supported storefront journey consistently and is designed not to block
shopping when analytics storage or delivery is unavailable.

## 4. Make editing truthful

The iframe editor connects manifest paths to rendered elements. Mark editable text and images with
the established `data-editor-*` attributes used by the existing template. Sections that merchants
can hide must render in editor mode even when disabled, while remaining hidden in the live shop.

Verify each manifest field against all of the following:

1. its path exists in the schema and defaults;
2. changing it updates the draft immediately;
3. the preview reflects the saved value;
4. publishing preserves the value; and
5. the live storefront renders the published value after cache invalidation.

Editor labels and help text are merchant-facing product copy. Explain the choice the merchant is
making; do not mention schemas, server checks, subscription enforcement, or implementation details.

## 5. Meet storefront quality requirements

A release candidate must provide:

- responsive layouts from small mobile screens through wide desktop screens;
- keyboard-visible focus and logical keyboard navigation;
- semantic headings, form labels, button names, and useful image alternative text;
- reduced-motion behavior for non-essential animation;
- local or merchant-owned visual assets without hotlinked demo images;
- responsive images with sensible dimensions, loading priority, and file size;
- honest empty, loading, unavailable, out-of-stock, and payment states;
- ETB formatting and long-content resilience; and
- a complete catalogue-to-confirmation purchase path.

Cart, payment, fulfilment, pricing, inventory, and customer state must remain authoritative. Never
invent a discount badge, stock state, delivery promise, payment success, or order result for visual
effect.

## 6. Add a public preview

After the template is production-ready, add a fixture-only preview journey under:

```text
apps/storefront/src/pages/demo/storefront/<slug>.astro
apps/storefront/src/pages/demo/storefront/<slug>/products/index.astro
apps/storefront/src/pages/demo/storefront/<slug>/products/[handle].astro
apps/storefront/src/pages/demo/storefront/<slug>/cart.astro
apps/storefront/src/pages/demo/storefront/<slug>/checkout.astro
apps/storefront/src/pages/demo/storefront/<slug>/order-confirmation.astro
```

The preview must use fictional data and local assets. It must not resolve a tenant, read a customer
session, call commerce APIs, record analytics, or allow cart and account mutations. The pages should
reuse the production template renderers and one coherent fixture so visitors can follow the real
catalogue-to-confirmation design without touching merchant data. Add the journey only after the real
template is complete; do not use it to advertise a design that is still awaiting approval.

Once the template is marked `selectable`, its branded preview URL is admitted automatically as
`https://demo.<base-domain>/<slug>`. The demo-host middleware reads the selectable registry; do not add
template-name conditions to middleware. Missing journey pages fail the cross-template compliance
suite, while non-selectable and unknown slugs remain unavailable on the demo host.

## 7. Verify before review

Run the focused template and storefront gates:

```bash
pnpm --dir packages/storefront-templates test
pnpm --dir packages/storefront-templates typecheck
pnpm --dir apps/storefront test
pnpm --dir apps/storefront typecheck
pnpm --dir apps/storefront build
```

Then complete a browser review at minimum for:

- home, catalogue, product, cart, checkout, and confirmation;
- empty and populated states;
- desktop and mobile widths;
- keyboard-only navigation;
- reduced motion;
- merchant editor draft, save, publish, and live rendering; and
- the fixture-only public preview.

The automated commerce-journey test confirms that every selectable template resolves the required
route slots. It does not replace visual, accessibility, content, or real checkout review.

## Release checklist

- [ ] Design and assets are final and licensed.
- [ ] Template key, UUIDs, version, description, and availability are correct.
- [ ] Schemas accept the complete defaults and reject malformed data.
- [ ] Every editor field edits, saves, publishes, and renders correctly.
- [ ] The full customer journey is visually coherent and functionally complete.
- [ ] Shared storefront analytics is mounted once and disabled in editor and fixture-demo modes.
- [ ] Loading, empty, unavailable, inventory, payment, and fulfilment states are truthful.
- [ ] Accessibility and responsive browser review is complete.
- [ ] Template package and Storefront tests, type checks, and build pass.
- [ ] The local registry synchronization completes successfully.
- [ ] The public preview is fictional, read-only, and added only after approval.

## When architecture review is required

Request review before adding:

- a new editor field kind or public page-data shape;
- a commerce mutation or browser persistence mechanism;
- template-specific behavior to a shared module;
- duplicated cart, wishlist, promotion, checkout, identity, or preview logic;
- a renderer slot whose responsibility overlaps an existing slot; or
- a new runtime dependency.

New shared capabilities should be added at the appropriate contract or commerce boundary. Do not
add template-name checks to the editor or storefront infrastructure. A dependency proposal must
explain its unique value, maintenance and security cost, bundle or runtime impact, alternatives in
the existing stack, and a practical removal path.

A template is complete only when its approved design works through the shared contracts without
template-specific business logic, live and preview rendering agree, the cross-template commerce
suite passes, and its accessibility, responsive, visual, and performance evidence is recorded.
