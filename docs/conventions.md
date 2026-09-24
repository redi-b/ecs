# Conventions

## Guardrails

| Rule | Why |
| --- | --- |
| Browser apps call the Platform API only | The commerce engine must not leak tenancy, admin APIs, or keys to the public internet |
| Never trust a client-supplied tenant id | Host and session are the source of truth |
| No per-merchant runtimes | The product is multi-tenant; every shop shares the platform |
| No merchant-uploaded executable code | Templates are repository code plus JSON; executable content in the database is an isolation failure |
| Commerce-engine admin UI off the public edge | Merchants and customers must not reach it |
| `/store/*` is an allowlisted facade | A generic proxy would expose unsafe engine routes |
| Cache keys include tenant or Host | Otherwise one shop can be served another shop’s HTML or JSON |
| Object keys under `tenants/{tenantId}/` | Same isolation |
| Custom-domain entitlement fails closed | Missing evaluation must not grant the capability |
| Shop checkout ≠ platform subscription | Different payers, payees, and credentials |
| English and Amharic together | New merchant strings ship in both catalogs |
| Operations cookie prefix ≠ merchant prefix | A merchant session must not authenticate on `ops.` |

Merchant-facing UI uses product language (shop, catalog, checkout, plan). Engine and infrastructure names stay in engineering documents and code.

## Layout

- Platform API: `routes/` + `modules/` + `adapters/`
- Dashboard server clients: `lib/platform-api/<resource>/`, never `"use client"`
- Storefront templates: package contract and Astro renderer in the same change
- Prefer small pull requests with a clear owning directory

## Quality

Before merging changes to tenancy, money, or authentication: `pnpm test`, `pnpm typecheck`, `pnpm lint`. Image CI does not replace those.

Two tenants must not observe each other’s catalog, orders, or media.

## Product language

Follow `PRODUCT.md` and `DESIGN.md`. Do not surface queue names, raw `commerce_*` codes, or incomplete features as “coming soon.”
