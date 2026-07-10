# syntax=docker/dockerfile:1.7

ARG NODE_VERSION=22-alpine

FROM node:${NODE_VERSION} AS workspace
ENV PNPM_HOME=/pnpm
ENV PATH=${PNPM_HOME}:${PATH}
WORKDIR /workspace
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/dashboard/package.json apps/dashboard/package.json
COPY apps/medusa/package.json apps/medusa/package.json
COPY apps/platform-api/package.json apps/platform-api/package.json
COPY apps/storefront/package.json apps/storefront/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/logger/package.json packages/logger/package.json
COPY packages/storefront-templates/package.json packages/storefront-templates/package.json

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

COPY . .

FROM workspace AS dashboard-build
ENV NEXT_TELEMETRY_DISABLED=1
RUN --mount=type=cache,id=next-cache,target=/workspace/apps/dashboard/.next/cache \
    pnpm --filter @ecs/dashboard build

FROM workspace AS storefront-build
ENV ASTRO_TELEMETRY_DISABLED=1
RUN --mount=type=cache,id=astro-cache,target=/workspace/apps/storefront/node_modules/.astro \
    pnpm --filter @ecs/storefront build

FROM workspace AS platform-api-build
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm --filter @ecs/platform-api deploy --prod /out/platform-api && \
    test -f /out/platform-api/node_modules/@ecs/db/migrations/meta/_journal.json

FROM workspace AS medusa-build
ENV DISABLE_MEDUSA_ADMIN=true
ENV MEDUSA_TELEMETRY_DISABLED=true
ENV XDG_CONFIG_HOME=/tmp/.config
RUN pnpm --filter @ecs/medusa build
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm --filter @ecs/medusa deploy --prod /out/medusa && \
    cp -R apps/medusa/.medusa/server/. /out/medusa/ && \
    node -e "require.resolve('@medusajs/draft-order/package.json', { paths: ['/out/medusa'] })" && \
    # Medusa db:migrate calls mkdir on each module's migrations/ path. Pre-create
    # empty dirs so migrate works on read-only rootfs (Node reports that mkdir as ENOENT).
    find /out/medusa/src/modules -mindepth 1 -maxdepth 1 -type d -exec mkdir -p {}/migrations \; && \
    find /out/medusa/node_modules -type d -name dist -exec mkdir -p {}/migrations \;
FROM node:${NODE_VERSION} AS runtime
RUN apk add --no-cache dumb-init
ENV NODE_ENV=production
WORKDIR /app

FROM runtime AS dashboard
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3001
COPY --chown=node:node --from=dashboard-build /workspace/apps/dashboard/.next/standalone ./
COPY --chown=node:node --from=dashboard-build /workspace/apps/dashboard/.next/static ./apps/dashboard/.next/static
USER node
EXPOSE 3001
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "apps/dashboard/server.js"]

FROM runtime AS storefront
ENV ASTRO_TELEMETRY_DISABLED=1
ENV HOST=0.0.0.0
ENV PORT=4321
COPY --chown=node:node --from=storefront-build /workspace/apps/storefront/dist ./dist
USER node
EXPOSE 4321
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server/entry.mjs"]

FROM runtime AS platform-api
ENV PORT=3000
COPY --chown=node:node --from=platform-api-build /out/platform-api ./
USER node
EXPOSE 3000
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "--import", "tsx", "src/index.ts"]

FROM runtime AS medusa
ENV DISABLE_MEDUSA_ADMIN=true
ENV MEDUSA_TELEMETRY_DISABLED=true
ENV PORT=9000
ENV XDG_CONFIG_HOME=/tmp/.config
COPY --chown=node:node --from=medusa-build /out/medusa ./
USER node
EXPOSE 9000
ENTRYPOINT ["dumb-init", "--"]
CMD ["node_modules/.bin/medusa", "start"]
