# Dashboard discovery cards

Status: production foundation in progress; the client-only prototype is not a shippable source of truth.

## Product decision

Discovery cards are occasional, contextual guidance for useful ECS capabilities that merchants may not find through navigation. They are not onboarding, billing notices, or a second notification inbox. The existing launch assistant remains responsible for required shop setup.

The dashboard must not show a discovery card on every first load. At most one campaign is eligible at a time. Campaigns should be selected from a deterministic priority order after their eligibility rules pass; randomness may vary an already-eligible queue later, but must not create surprise interruptions for new shops.

Current client defaults:

- setup-dependent campaigns wait until the storefront is published or launch readiness is fully ready;
- Telegram can appear after setup completion and the first eligible dashboard session;
- custom domains can appear after setup completion;
- POS waits for at least two dashboard sessions and 24 hours from first discovery use;
- a shown campaign creates a seven-day impression cooldown;
- “Not now” snoozes that campaign for 30 days;
- opening a campaign does not mark the feature complete; it may return after the cooldown until the relevant feature state confirms completion.

The first schema foundation is tenant-safe and server-owned: `dashboard_discovery_campaigns` stores versioned campaign policy/content, while `dashboard_discovery_events` records impressions and actions. Browser storage must not be used as the source of truth. The dashboard client will consume an authorized platform API for eligibility and event writes.

## Planned operator contract

The eventual platform-owned discovery campaign record should include:

- stable campaign ID and translated content;
- deep link and optional completion signal;
- start/end window, priority, audience/permission requirements, and feature eligibility;
- impression cooldown, maximum impressions, snooze duration, and permanent opt-out policy;
- enabled/disabled state and audit fields.

Impressions, clicks, snoozes, dismissals, and completion should be tenant-safe events. Operators should be able to publish, pause, schedule, reorder, and retire campaigns without a dashboard image deployment.

Do not use discovery cards for urgent account/security/billing states; those belong to the existing alert and notification surfaces.

## Verification direction

The eventual test harness should seed a campaign and tenant event history through the platform API, then verify eligibility, impression caps, snooze behavior, completion suppression, tenant isolation, and operator pause/schedule changes. Do not rely on manually editing browser storage for production verification.
