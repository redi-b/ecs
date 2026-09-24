# ECS documentation

Technical documentation for people who maintain and extend ECS: engineers, operators, and designers on the team.

The root [README](../README.md) is the clone-and-run card. Merchant-facing voice is defined in `PRODUCT.md` and `DESIGN.md`.

If documentation disagrees with the code, the code wins. Update this folder in the same change.

## Contents

| Topic | Document |
| --- | --- |
| Local setup | [Getting started](./getting-started.md) |
| System design | [Architecture](./architecture.md) |
| Apps and packages | [Surfaces](./surfaces.md) |
| Catalog, checkout, storefront, Insights | [Commerce](./commerce.md) |
| Shop payments and platform plans | [Payments and billing](./payments-and-billing.md) |
| Plan operator UI | [Billing and plans](./billing-and-plans.md) |
| Product search | [Product search](./operations/meilisearch.md) |
| New storefront template | [Add a template](./storefront-templates/adding-a-template.md) |
| Deploy, backups, DNS | [Operations](./operations.md) |
| Guardrails and contribution rules | [Conventions](./conventions.md) |

## Product

ECS is a hosted, multi-tenant commerce platform for Ethiopian merchants. Each shop has a storefront, catalog, checkout, and a bilingual (English / Amharic) dashboard. Merchants do not assemble their own hosting, storefront software, commerce engine, or payment stack.

Shops share one platform. Scaling the runtime (more app processes, managed data stores, a different orchestrator) does not change that: shops still share tenancy, routing, and operations.

| Audience | Surface |
| --- | --- |
| Merchant | `app.{base}` and `{shop}.{base}/dashboard` |
| Customer | `{shop}.{base}` |
| Platform operator | `ops.{base}` |

Storefront templates in the catalogue: `luvia@1` and `nexahub@1`.
