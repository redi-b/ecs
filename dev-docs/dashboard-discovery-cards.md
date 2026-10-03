# Dashboard discovery cards

Status: production foundation implemented; domain UI remains separate. The dashboard client and
operator console consume the server-owned candidate and campaign APIs.

## Verified product references

Research retrieved from official Appcues documentation on 2026-10-03:

- [Event triggering](https://docs.appcues.com/user-experiences-targeting/event-triggering): experiences can respond to an application event rather than a page load, while still respecting audience eligibility.
- [Audience targeting](https://docs.appcues.com/user-experiences-targeting/audience-targeting): eligibility combines properties, events, segments, and interaction history.
- [Frequency limits](https://docs.appcues.com/user-experiences-targeting/experiences-frequency-limit): global limits are distinct from individual experience frequency; a collection of individually eligible campaigns must not overwhelm a user.
- [Scheduling](https://docs.appcues.com/user-experiences-targeting/scheduling-a-flow): operators control start/end windows and manual publishing/unpublishing.

ECS application of these patterns (our design decisions, not vendor requirements):

- first-load delivery is allowed only when explicitly configured for a campaign; setup gating is campaign-specific;
- feature nudges use authoritative feature availability, permissions, completion state, and lifecycle signals;
- eligibility is evaluated server-side and a delivery is reserved atomically before rendering to prevent concurrent tabs/devices from bypassing caps;
- an impression is acknowledged only after visible rendering, not merely when fetching candidates;
- event replay is idempotent; merchant event submissions cannot manufacture feature completion;
- snooze, permanent dismissal, click, and feature completion are distinct states;
- any future operator preview must be permission-checked and non-counting; production eligibility
  must never be bypassed with a query-string flag;
- operator edits/pause/schedules are audited and validated; no arbitrary HTML or unbounded external links;
- tenant cadence and per-member choices must be explicit and must not accidentally suppress useful guidance for all staff after one person's dismissal.

Current implementation: eligibility is evaluated server-side from campaign windows, permissions, setup state, session history, per-campaign cooldowns, global cooldown, snooze/dismissal/completion events, and impression caps. Candidate delivery reserves one campaign with a unique idempotency key before it is rendered. Event names are allowlisted and event writes require an idempotency key. Sessions are recorded server-side with a tenant/user/day idempotency key; browser storage is not an eligibility source. Operators can list campaigns and activate, pause, schedule, or retire them from the Operations Discovery workspace. Updates require a reason and are audited.

Remaining verification work: add focused service/route integration coverage for cooldowns,
snooze, impression caps, tenant isolation, and concurrent reservation. Replacing startup default
insertion with the normal deployment seed path remains an operational hardening option, not a
merchant-facing dependency.

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

## Operator contract

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
