import concurrently from "concurrently";

const { result } = concurrently(
  [
    {
      name: "api",
      command: "pnpm --filter @ecs/platform-api dev",
    },
    {
      name: "worker",
      command: "pnpm --filter @ecs/platform-api dev:worker",
    },
    {
      name: "dashboard",
      command: "pnpm --filter @ecs/dashboard dev",
    },
    {
      name: "storefront",
      command: "pnpm --filter @ecs/storefront dev",
    },
    {
      name: "medusa",
      command: "pnpm --filter @ecs/medusa dev",
    },
    {
      name: "medusa-worker",
      command: "pnpm --filter @ecs/medusa dev:worker",
    },
  ],
  {
    prefix: "[{time}] [{name}]",
    prefixColors: ["cyan", "yellow", "magenta", "blue", "green", "gray"],
    killOthersOn: ["failure"],
    restartTries: 0,
    timestampFormat: "HH:mm:ss",
  },
);

try {
  await result;
} catch {
  process.exitCode = 1;
}
