FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/platform-api/package.json apps/platform-api/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/logger/package.json packages/logger/package.json
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm --filter @ecs/platform-api build

CMD ["pnpm", "--filter", "@ecs/platform-api", "start"]
