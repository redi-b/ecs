# ADR 0002: Apply published plan versions at renewal

## Status

Accepted

## Context

Plans are stable commercial identities, while plan versions are immutable terms. Updating the mutable plan projection alone made the operator catalog and merchant billing views disagree. Replacing a subscription's version immediately would also rewrite access during a period that was already paid for.

Billing systems such as Stripe and Paddle model future subscription terms as scheduled phases or changes. Prices used by subscriptions remain versioned, and an end-of-period change is distinct from an immediate prorated change.

## Decision

- Publishing a plan creates an immutable plan version and updates the plan's latest projection.
- Subscriptions stay pinned to their current version until the active billing period ends.
- Publishing schedules every active subscription on an older version of that plan to use the newest version at renewal.
- A later publication replaces an earlier pending renewal version.
- The complete version moves together: price, interval, limits, capabilities, and trial policy.
- Renewal invoices pin the scheduled version and its price. Paying that invoice activates the pinned version and clears the schedule.
- Free subscriptions also have real monthly period boundaries. A free-to-free renewal transition applies automatically at the boundary and creates no payable invoice.
- Existing invoices are immutable and are never rewritten by a later publication.
- Seed data is insert-only after bootstrap. Runtime reads cannot overwrite operator-managed plans.

## Consequences

- Merchant status can show both current terms and an upcoming renewal change.
- Entitlements remain stable throughout the paid period.
- Invoice settlement is deterministic because the invoice identifies the version being purchased.
- Free and paid subscriptions share period semantics, usage-reset boundaries, and reporting concepts.
- A future provider adapter can map the renewal transition to its native schedule without changing the domain contract.

## Non-goals

- Mid-period proration.
- Mutating issued invoices.
- Indefinite grandfathering by default.
- Encoding renewal state in provider-specific metadata or payment-state strings.

## References

- Stripe subscription schedules: https://docs.stripe.com/billing/subscriptions/subscription-schedules/use-cases
- Stripe subscription updates and proration: https://docs.stripe.com/api/subscriptions/update
- Paddle scheduled subscription changes: https://developer.paddle.com/changelog/2025/update-subscriptions-scheduled-change
