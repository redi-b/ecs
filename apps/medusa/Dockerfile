FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/medusa/package.json apps/medusa/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/logger/package.json packages/logger/package.json
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm --filter @ecs/medusa build

CMD ["pnpm", "--filter", "@ecs/medusa", "dev"]
