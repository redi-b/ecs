FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/storefront/package.json apps/storefront/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/storefront-templates/package.json packages/storefront-templates/package.json
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm --filter @ecs/storefront build

CMD ["pnpm", "--filter", "@ecs/storefront", "preview"]
