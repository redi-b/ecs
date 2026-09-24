# Medusa

Medusa is the commerce backend for products, carts, orders, payment state, fulfillment, inventory, stores, sales channels, and publishable API keys.

Run commands from the repository root:

```bash
pnpm --filter @ecs/medusa dev
pnpm --filter @ecs/medusa dev:worker
pnpm --filter @ecs/medusa db:migrate
pnpm --filter @ecs/medusa seed
```

Custom commerce behavior should use Medusa modules, links, workflows, subscribers, API routes, payment providers, and fulfillment providers. Do not patch Medusa core.
