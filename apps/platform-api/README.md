# Platform API

Hono service that owns platform routes, tenant resolution, auth/session boundaries, Store API facade behavior, platform workers, seeds, and operator APIs.

This app may call Medusa through the internal network. Browsers must not call Medusa Admin API directly.

## Worker (`pnpm --filter @ecs/platform-api dev:worker`)

Requires `REDIS_URL` and platform DB. Registers BullMQ handlers including:

| Job | Purpose | Default schedule |
|-----|---------|------------------|
| `notifications.deliver` | Outbound email/Telegram | On enqueue |
| `billing.lifecycle` | Renewals, past_due, scheduled free downgrades | BullMQ repeatable every 1h (`BILLING_LIFECYCLE_INTERVAL_MS`) |
| `billing.reconcile-payments` | Re-verify pending Chapa `ecs_bill_*` invoices | BullMQ repeatable every 5m (`BILLING_RECONCILE_INTERVAL_MS`) |
| `system.ping` | Health probe for the jobs stack | Manual / tests |

Schedules use **BullMQ repeatable jobs** (not process `setInterval`). Set an interval to `0` to remove that repeatable. Handlers still work if you `enqueueJob` manually.

## Chapa (platform billing + commerce)

- **callback_url** (server): `{PLATFORM_PUBLIC_BASE_URL}/platform/payments/chapa/callback` — Chapa notifies us; we **verify** with `CHAPA_SECRET_KEY` then apply.
- **return_url** (browser): merchant/storefront return; billing also re-verifies on `paid=1`.
- Platform subscription refs use the `ecs_bill_` prefix so they never hit Medusa capture.

See `dev-docs/post-mvp/09-billing-v1-free-and-growth.md` for the full billing v1 flow.
