# Payments and billing

Keep shop checkout and platform subscriptions separate in copy, webhooks, and credentials.

| Flow | Payer | Payee | Methods |
| --- | --- | --- | --- |
| Shop checkout | The shop’s customer | The merchant | Cash on delivery; Chapa when the merchant enables it |
| Platform subscription | The merchant | ECS | Invoices, transfer or wallet proof, operator review |

Shop Chapa uses the merchant’s secret and a distinct `tx_ref` space. Platform invoice references use the `ecs_bill_` prefix so they cannot be captured as a shop payment. A Chapa collector for platform invoices exists in the worker (`billing.reconcile-payments`); shop checkout must never use the platform Chapa key.

## Shop checkout

- Cash on delivery is always available. Fees follow delivery settings.
- Chapa: Settings → Payments. Encrypted secret, enablement toggle, shop return URL, Platform API callback. Verification uses **that shop’s** key.
- Manual and Telegram sales: settlement method is explicit.

## Platform plans

Plans are versioned. Publishing creates a new version. Existing shops stay on the version they accepted. An operator may move a shop to another published version with an audited reason. That action does not collect payment, issue a refund, or rewrite invoices.

Capabilities (for example `customDomains`) come from `plans.features` JSON, fail closed, and are never inferred from the plan name. Product-count limits apply to create and to CSV import.

The merchant Billing page shows the active plan, limits, invoices, and available choices.

Operator UI steps: [Billing and plans](./billing-and-plans.md).

## Boundaries

- Confirm external evidence before marking a platform invoice paid.
- Billing tables are not the company ledger.
- Do not edit published plan rows in SQL.
- Deploy Platform API, worker, dashboard, and Operations from the same image tag. Apply platform database migrations before processing new billing work.
- Keep `billing.lifecycle` running (renewals, past-due).
