# Billing domain language

This glossary describes business meaning. It intentionally does not prescribe storage, frameworks, providers, or user interfaces.

## Terms

**Account** — The party receiving service and responsible for a subscription.

**Plan** — A named commercial offering whose terms may change over time.

**Plan version** — One immutable set of a plan's price, billing interval, capabilities, and limits.

**Capability** — A named permission or allowance offered to an account.

**Boolean capability** — A capability that is either available or unavailable.

**Limited capability** — A capability that permits no more than a defined quantity within its scope.

**Entitlement** — The effective capability granted to an account by its subscription and any valid override.

**Subscription** — An account's assignment to one plan version over a period of time.

**Billing period** — The interval for which subscription access and recurring allowances apply.

**Override** — A deliberate, time-bounded or permanent change to one account's entitlement, with a reason and accountable actor.

**Decision** — The allow or deny result for a requested capability, including a stable reason and the source of the result.

**Reservation** — A temporary, exclusive claim against a limited capability before the protected business action completes.

**Commit** — Conversion of a reservation into consumed capacity after the protected action succeeds.

**Release** — Return of an uncommitted reservation's capacity after failure, cancellation, or expiry.

**Usage** — Committed consumption of a limited capability in its applicable period or lifetime scope.

**Payment attempt** — One provider interaction intended to pay an invoice.

**Invoice** — The amount due for a subscription period or approved change.

**Provider event** — A message from a payment provider that may confirm or reject a payment attempt.

## Invariants

- Published plan versions never change.
- A subscription always identifies the exact plan version whose terms it receives.
- A plan change never silently changes an existing subscription.
- Missing or invalid capability data cannot grant access.
- Committed usage plus active reservations cannot exceed a hard limit.
- A reservation can be committed at most once and released at most once.
- Reprocessing the same provider event cannot apply its business effect twice.
- An override without an accountable reason is invalid.
- Access state and payment state are related but remain distinguishable.
