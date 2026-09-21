# Commerce, catalog, and storefront

## Catalog

Merchants manage products in the dashboard. The Platform API mutates the commerce engine on the internal network. Variants, stock, options, categories, collections, and translations are engine resources scoped to that shop’s store and sales channel.

- Option values may carry a color swatch in option-value metadata. The visible label stays a name (`Midnight`), not `#RRGGBB`. Storefronts use shared swatch data with a text fallback.
- Rich descriptions use a stored-content contract and sanitization. Templates share one renderer. Plain-text descriptions still display.
- Customer-facing category and collection URLs use **handles**. Identifier URLs redirect.
- CSV import and export exist. Export is safe to run; import overwrites catalog data and should be used with a prior export.
- Media: `image/avif`, `gif`, `jpeg`, `png`, `webp`; 15 MiB; keys under `tenants/{tenantId}/`; presigned PUT with signed `content-type`. Completing an upload confirms the object exists.
- Catalog lists show a **source name** plus an አማ mark. The mark opens the other language and translation status. **Catalog names** on the count strip can follow the dashboard language, or pin English or Amharic. Form fields stay in the source language.

## Cart, checkout, orders

Storefront commerce goes through `/store/*` (shop-host `/api` or `api.{base}`).

- **Cash on delivery / pay on pickup** uses delivery settings and zone fees.
- **Chapa** is optional per shop (Settings → Payments). The shop’s secret is encrypted. The callback hits the Platform API, which re-verifies `tx_ref` with Chapa using that shop’s key. The `tenant_id` on the callback must match the payment.
- Platform subscription collection is separate: [Payments and billing](./payments-and-billing.md).
- Manual and Telegram orders require an explicit settlement method.

Merchants can record refunds on an order, including a partial amount, with method and reason (cash, Telebirr, CBE Birr, bank transfer). Returns and exchanges as a separate workflow are not implemented.

## Customers

Shop customers live in the commerce engine. The platform can attach notes. Customer detail lists recent orders, a total count, and a link to the orders table filtered by that customer.

## Search

Meilisearch is a rebuildable index. The platform database and commerce engine are authoritative. See [Product search](./operations/meilisearch.md). After a database restore, reindex.

## Storefront templates

Templates own presentation and editable content. Catalogue, cart, checkout, accounts, payment, and fulfilment are shared.

| Key | Notes |
| --- | --- |
| `luvia@1` | Catalogue template |
| `nexahub@1` | Catalogue template |
| `mesob@1` | Resolves to `luvia@1` |

Contracts: `packages/storefront-templates`. Renderers: `apps/storefront/src/templates`. The database stores JSON content, not template source.

Incompatible schema or markup changes require a new version (`luvia@2`). Compatible copy and theme fixes stay on the current version.

Editor preview is the same Astro app. Reverting an image, including the logo, must update the live preview without a full reload.

Adding a template: [Add a template](./storefront-templates/adding-a-template.md). A template is published only with a complete customer journey and editor experience.

## Languages

English and Amharic are both product languages. Storefront: `apps/storefront/messages/{en,am}.json` (`pnpm --dir apps/storefront i18n:check`). Dashboard: `next-intl`. New merchant strings need both. Amharic titles: no negative tracking (`DESIGN.md`).

## Insights

Merchant Insights (`/dashboard/insights`) is a reporting workspace. Permission: `insights:read`. Responses are `private, no-store`.

| Report | Path | Source |
| --- | --- | --- |
| Sales | `/dashboard/insights` and `/dashboard/insights/sales` | Platform commerce totals (orders, revenue, comparison period) plus product contribution |
| Products | `/dashboard/insights/products` | Demand / contribution (units, search, sort, pagination) |
| Storefront | `/dashboard/insights/storefront` | Storefront activity; traffic dimensions from the analytics provider (Umami). `/journey` and `/traffic` render this report |

Date range and comparison query params are shared across reports. Export and refresh live in the header. Refresh records quality (last successful at, retry). A provider outage hides traffic panels only; sales and ECS-native activity stay available.

Umami is not the source of revenue. Financial totals always come from ECS. Dashboard code must not import Umami types or call Umami; the Platform API normalizes traffic through an adapter.

Overview on the dashboard home remains a separate, shorter operations snapshot.

## Inquiries

Storefront contact forms include a honeypot field `website` (filled honeypots receive a generic success). Rate limit: five submissions per ten minutes per tenant and client IP, in process memory on the API. Merchants manage those submissions under dashboard Inquiries (status updates). Inbox notifications can be filtered to the inquiries category.
