# ECS landing page

The public ECS marketing site. It is an Astro SSR app in the ECS pnpm workspace.

## Local development

Copy `.env.example` to `.env`, then run the app alone:

```bash
pnpm --filter @ecs/landing dev
```

With the repository development proxy running, open `http://ecs.lvh.me`.

The app reads its Platform API and dashboard origins at runtime. Production
deployments provide them through `infra/dokploy/docker-compose.yml`; do not bake
deployment-specific service URLs into application code.
