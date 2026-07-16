/**
 * Template page-slot contract.
 *
 * - Stable public routes always resolve through thin `src/pages/*` loaders.
 * - Each template may supply Astro page components for optional slots.
 * - Missing slots use shared fallbacks under `templates/fallback/`.
 * - Templates reuse `src/lib/commerce` for logic, not UI.
 *
 * Component types are intentionally loose (`any`) so Astro components from
 * different templates type-check when used as dynamic tags.
 *
 * @see dev-docs/post-mvp/14-storefront-completeness-and-templates-plan.md
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type StorefrontPageComponent = any;

export type StorefrontRenderer = {
  /** Required: CMS/marketing home */
  Home: StorefrontPageComponent;
  /** Optional shell; not all routes use it yet */
  Layout?: StorefrontPageComponent;
  ProductList?: StorefrontPageComponent;
  Product?: StorefrontPageComponent;
  Cart?: StorefrontPageComponent;
  Checkout?: StorefrontPageComponent;
  OrderConfirm?: StorefrontPageComponent;
};

export type StorefrontRendererMap = Record<string, StorefrontRenderer>;
