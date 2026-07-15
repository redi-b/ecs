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

Downgrade to Free (implemented)
  → if paid period still active: schedule free plan at currentPeriodEnd (no refund)
  → voids open pay/renewal invoices; skips renewal invoices while scheduled
  → at period end (lifecycle): switch to Free, clear period end
  → if already past_due / expired: apply Free immediately
  → cancel anytime before effective date (Keep this plan)
```

## Free plan rules

- Never create payment invoices for price=0 plans.
- New shops get Free `active` without a pay path.
- Legacy Starter `trialing` soft-migrates to free forever; paid-plan trials untouched.
- Downgrade Free switch is scheduled at period end; no cash refund for unused days.

## Chapa isolation

- Commerce order `tx_ref` values do **not** use the `ecs_bill_` prefix.
- Callback: if `tx_ref` starts with `ecs_bill_`, complete **platform invoice** payment; else existing Medusa capture.

## Payment completion (callback vs return)

Chapa is initialized with **both**:

| URL | Who hits it | Role |
|-----|-------------|------|
| `callback_url` | Chapa servers → `PLATFORM_PUBLIC_BASE_URL/platform/payments/chapa/callback` | **Primary.** Server notify (Chapa’s name for what other PSPs call a webhook). |
| `return_url` | Merchant browser after checkout | UX + `paid=1` confirm re-verify |

**Security:** never mark paid from query `status=success` alone. Callback and confirm both call Chapa **transaction verify** with `CHAPA_SECRET_KEY`, then apply.

**Dependability:**

1. Production: `PLATFORM_PUBLIC_BASE_URL` must be **public HTTPS** Chapa can reach.
2. Local `lvh.me` is not reachable from Chapa → rely on return confirm + worker reconcile.
3. Worker job `billing.reconcile-payments` (default every 5m) re-verifies pending `ecs_bill_*` invoices so a missed callback still applies if the merchant never reopens Billing.

Env (platform-api / worker):

- `CHAPA_SECRET_KEY`, `CHAPA_API_URL`
- `PLATFORM_PUBLIC_BASE_URL`
- `CHAPA_FALLBACK_EMAIL` (demo `*.local` owners)
- `BILLING_RECONCILE_INTERVAL_MS` (default `300000`; `0` disables schedule)
- `BILLING_LIFECYCLE_INTERVAL_MS` (default `3600000`; `0` disables schedule)

## Lifecycle

| Trigger | Behavior |
|---------|----------|
| `getBillingStatus` / overview load | `syncTenantBillingLifecycle` for that tenant |
| Worker job `billing.lifecycle` | Sweep all paid subscriptions (renewals, past_due, scheduled free downgrades) |
| Worker job `billing.reconcile-payments` | Verify pending Chapa plan invoices and apply successes |

Renewal lead window: **7 days** before `currentPeriodEnd`.

Worker registers **BullMQ repeatable jobs** on startup (`scheduleRepeatableJob` in `@ecs/jobs`). Redis owns the cadence; each fire creates a `job_runs` row.

## Done

- Free forever + Growth catalog
- Upgrade invoice + Chapa pay + period extend
- Billing page plan selection UX (dedicated billing API, not full dashboard summary)
- Renewal invoice + past_due
- Overview notices (paid only)
- Schedule free downgrade at period end (cancelable; no refunds)
- Pending Chapa invoice reconcile job + worker schedule
- Lifecycle worker schedule

## Still later (not v1)

- Feature gates / enforcement when suspended
- Grace period distinct from past_due
- Suspend storefront automation
- Operator cash tools
- Billing email/Telegram dunning notifications
