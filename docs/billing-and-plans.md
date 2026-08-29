# Billing and plans

ECS keeps platform subscriptions separate from each shop's customer payments. A merchant's plan
controls access to platform capabilities and enforced limits; it does not change the way customers
pay that merchant.

## What the current foundation supports

- Published plan versions that cannot be edited after release
- Existing merchants remaining on the version they accepted
- Plan capabilities, currently including custom-domain access
- Enforced limits, currently including the number of products a shop may create
- Free and paid subscription states
- Manual invoice review and verified Chapa payment confirmation
- Renewal invoices, payment reminders, and past-due handling
- Audited operator corrections when a merchant must move to another published version

Plan names, prices, and final tier contents are commercial decisions and can be changed before
launch without redesigning the billing system.

## Managing plans in ECS Operations

Open **Plans** in ECS Operations to review the catalog.

1. Choose **Edit draft** on a plan.
2. Enter the proposed name, monthly price, product limit, and custom-domain access.
3. Record the business reason and save the draft.
4. Review the draft, then choose **Review and publish**.

Publishing creates a new version. It does not change existing subscriptions automatically. This
protects merchants from having their accepted terms changed without an explicit decision.

To correct one merchant's subscription, open the merchant in ECS Operations and select
**Controls → Subscription terms**. Choose the exact published version and record the approved
reason. This change is immediate, but it does not collect payment, issue a refund, or rewrite an
existing invoice.

## What merchants see

The merchant Billing page shows the active plan, its product limit, custom-domain availability,
open invoices, and available plan choices. Product creation is blocked at the server when the
active limit has been reached, including during CSV import.

## Operational boundaries

- Use a plan-version change only for an approved correction or commercial decision.
- Confirm external payment evidence before marking an invoice paid.
- Do not treat ECS billing records as a general accounting ledger.
- Do not edit published plan data directly in the database.
- Keep plan and subscription permissions limited to operators who manage billing.

## Deployment

No new billing-specific environment variable is required. Deploy the Platform API, worker,
dashboard, and Operations console from the same release, then apply the Platform database
migrations with `pnpm db:migrate` before processing new billing work.

The lifecycle worker and notification delivery must remain enabled. PostgreSQL is the authority for
plan versions, subscriptions, invoices, usage reservations, verified payment events, and the billing
outbox.
