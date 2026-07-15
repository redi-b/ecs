# Billing v1: Free forever + Growth (Chapa)

Date: 2026-07-15  
Status: implementing

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

Renewal (later / same path)
  → issue pending invoice while on Growth
  → same Pay → Chapa → extend
```

## Free plan rules

- Never create payment invoices for price=0 plans.
- Trial credit invoices are optional historical; new shops get Free `active` without a pay path.

## Chapa isolation

- Commerce order `tx_ref` values do **not** use the `ecs_bill_` prefix.
- Callback: if `tx_ref` starts with `ecs_bill_`, complete **platform invoice** payment; else existing Medusa capture.

## Non-goals (v1)

- Operator mark paid, grace automation, suspend, multi-plan catalog UI polish, yearly only optional.
