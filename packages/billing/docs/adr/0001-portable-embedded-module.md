# ADR 0001: Build billing as a portable embedded module

- Status: Accepted
- Date: 2026-08-28

## Context

ECS needs configurable plans, subscriptions, capabilities, hard limits, Ethiopian payment providers, and operator controls. Current rules are split between application services and mutable JSON plan fields. External engines add operational weight, while the most relevant TypeScript framework is not yet mature enough for ECS's concurrency and multi-worker requirements.

## Decision

Create a framework-independent `@ecs/billing` Module. Its Interface expresses business commands, decisions, repositories, clocks, identifiers, and transactions. ECS-specific database, payment, job, API, merchant, and Operations Implementations connect through Adapters.

The Module owns domain invariants but does not own HTTP, persistence technology, provider SDKs, or UI. Published plan versions are immutable. Hard limits use reservations rather than a check-then-increment API.

## Consequences

- ECS can embed the Module without deploying another service.
- Extracting it later requires replacing Adapters, not rewriting policy.
- Initial work is deeper than adding more JSON fields, but rules gain one discoverable home and stronger tests.
- Provider and persistence features cannot leak into core types for convenience.
- Operations is a consumer of the same application Interface as other trusted callers.

## Alternatives considered

- **Adopt BirrJS now:** good concepts and Ethiopian provider focus, but insufficient reservation and multi-instance guarantees for the core.
- **Run Lago or Kill Bill:** mature billing capabilities, but operational and integration cost is premature before ECS has settled tiers and usage pricing.
- **Keep rules inside Platform API:** fastest locally, but preserves coupling and makes later extraction expensive.
