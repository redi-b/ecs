# Billing v1: Free forever + Growth (Chapa)

Date: 2026-07-15  
Status: implemented (core + lifecycle)

## Decisions (product)

- **Starter (Free):** forever free, no invoices, no Chapa, no gates.
- **Growth:** paid prepaid plan for real money and for testing the full loop.
- **Self-serve:** merchant can upgrade Free → Growth from Billing and pay via Chapa.
- **Chapa only** for money movement in product. No operator mark-cash/bank UI.
- **No support override APIs** in v1.
- **No feature gates** in v1 (limits stored for later).
- Platform owns subscription periods; Chapa is one-shot checkout per invoice.

## Flow

```text
Provision shop
  → Free subscription (active, no due pressure)

Upgrade to Growth
  → create pending invoice (plan price, ETB)
  → Pay → Chapa initialize (tx_ref = ecs_bill_{invoiceId})
  → merchant pays on Chapa
  → callback verify success
  → invoice paid + subscription plan=Growth, period extended, status=active

Renewal (implemented)
  → within 7 days of period end (or after end): pending renewal invoice
  → same Pay → Chapa → extend
  → if period ended unpaid: status past_due (lazy on billing read + worker job)
```

## Free plan rules

- Never create payment invoices for price=0 plans.
- New shops get Free `active` without a pay path.
- Legacy Starter `trialing` soft-migrates to free forever; paid-plan trials untouched.

## Chapa isolation

- Commerce order `tx_ref` values do **not** use the `ecs_bill_` prefix.
- Callback: if `tx_ref` starts with `ecs_bill_`, complete **platform invoice** payment; else existing Medusa capture.

## Lifecycle

| Trigger | Behavior |
|---------|----------|
| `getBillingStatus` / overview load | `syncTenantBillingLifecycle` for that tenant |
| Worker job `billing.lifecycle` | Sweep all paid subscriptions |

Renewal lead window: **7 days** before `currentPeriodEnd`.

## Done

- Free forever + Growth catalog
- Upgrade invoice + Chapa pay + period extend
- Billing page plan selection UX
- Renewal invoice + past_due
- Overview notices (paid only)

## Still later (not v1)

- Feature gates / enforcement when suspended
- Grace period distinct from past_due
- Suspend storefront automation
- Operator cash tools
- Scheduled cron that enqueues `billing.lifecycle` daily (handler exists; schedule ops TBD)
- Billing email/Telegram dunning notifications
