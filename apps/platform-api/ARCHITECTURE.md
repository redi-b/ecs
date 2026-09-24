# Platform API architecture

The Platform API is a modular monolith. It deploys as one process, but business capabilities are
owned by explicit modules and assembled at one composition root.

## Runtime boundaries

- `src/index.ts` is the executable composition root for the HTTP process. It owns final dependency assembly and process startup; business logic and provider protocols belong behind focused modules.
- `src/bootstrap/` owns process configuration, provider construction, lifecycle, and dependency
  assembly. Bootstrap modules may depend on any application module; application modules must not
  depend on bootstrap.
- `src/modules/<capability>/` owns business rules and persistence for one capability. A module
  exposes a small service interface rather than its database tables or provider details.
- `src/adapters/<provider>/` translates external systems into application-facing interfaces.
- `src/routes/<surface>/` owns HTTP parsing, authorization at the route boundary, and response
  mapping. Routes delegate business decisions to modules.
- `src/context/` owns cross-route request context such as tenant and principal resolution.
- `src/jobs/` owns durable job registration and handlers. Handlers call modules; modules do not
  know about the queue transport.

Dependencies point inward from transport and providers toward capability modules. Cross-capability
calls should use a service interface, not another module's repository or database schema.

## Composition rules

`src/index.ts` is allowed to be explicit and somewhat repetitive. It is the
only place that should know how the complete process is wired. It must not contain business rules,
request parsing, or provider protocol logic. Cohesive provider setup belongs in focused bootstrap
factories such as `billing.ts`, `commerce.ts`, `tenant.ts`, `payments.ts`, and `platform-operations.ts`.

Avoid these false cleanups:

- barrel files that only hide dependency direction;
- controller/service/repository layers with no behavior at their boundary;
- a global service locator passed to every route;
- moving a large block unchanged into a generically named `runtime.ts`;
- importing through a package's legacy aggregate entrypoint from inside this application.

## Tests

- Keep focused unit and module integration tests next to the implementation as `*.test.ts`.
- Keep cross-module HTTP tests under `test/integration/`.
- Keep shared test builders under `test/support/`; they must expose intent-focused builders rather
  than a second production service locator.
- Prefer one behavior area per test file. A test file should normally remain below 500 lines. A
  larger file is a review signal, not an automatic failure: split it when tests no longer share a
  meaningful fixture or capability boundary.
- Database-backed tests must remain tenant-isolated and must never silently fall back to mocks.

## Route dependency contracts

`PlatformAppOptions` composes capability contracts from `src/types/platform-*-options.ts` for the
final application boundary. Individual route families must still declare the narrowest practical
`Pick` contract and receive only their authorization, use-case, and projection dependencies. Do not
pass the complete application contract into new route modules or wrap the same callbacks in a
cosmetic object tree.

## References

The structure follows the same core ideas as Hono route composition, Fastify plugin encapsulation,
and Nest feature modules: explicit composition, capability ownership, and small public module
interfaces. ECS deliberately does not copy Nest's decorator or class conventions because they add
no value to this functional TypeScript codebase.

- <https://hono.dev/docs/guides/best-practices>
- <https://fastify.dev/docs/latest/Guides/Plugins-Guide/>
- <https://docs.nestjs.com/modules>
- <https://docs.nestjs.com/fundamentals/testing>
