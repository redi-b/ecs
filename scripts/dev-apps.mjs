#!/usr/bin/env node
/**
 * Start local app processes (assumes infra + migrations already done).
 *
 *   pnpm dev:apps
 *   pnpm dev:apps --grouped
 *   pnpm dev:apps --split-medusa
 */
import { spawn } from "node:child_process";
import concurrently from "concurrently";

import { blank, box, color, heading, info, kv } from "./lib/cli.mjs";

process.env.NODE_ENV = "development";

const args = new Set(process.argv.slice(2));
const groupedLogs = args.has("--grouped") || process.env.DEV_LOG_MODE === "grouped";
const splitMedusa = args.has("--split-medusa") || process.env.MEDUSA_DEV_MODE === "split";

const services = [
  {
    color: "cyan",
    command: "pnpm --filter @ecs/platform-api dev",
    name: "api",
    title: "Platform API",
  },
  {
    color: "yellow",
    command: "pnpm --filter @ecs/platform-api dev:worker",
    name: "worker",
    title: "Platform worker",
  },
  {
    color: "magenta",
    command: "pnpm --filter @ecs/dashboard dev",
    name: "dashboard",
    title: "Dashboard",
  },
  {
    color: "blue",
    command: "pnpm --filter @ecs/storefront dev",
    name: "storefront",
    title: "Storefront",
  },
  {
    color: "green",
    command: splitMedusa
      ? "pnpm --filter @ecs/medusa dev:server"
      : "pnpm --filter @ecs/medusa dev",
    name: "medusa",
    title: splitMedusa ? "Medusa server" : "Medusa",
  },
  ...(splitMedusa
    ? [
        {
          color: "gray",
          command: "pnpm --filter @ecs/medusa dev:worker",
          name: "medusa-w",
          title: "Medusa worker",
        },
      ]
    : []),
];

heading("ECS app processes");
kv([
  ["Mode", groupedLogs ? "grouped (dashboard view)" : "streaming (prefixed logs)"],
  ["Medusa", splitMedusa ? "split server + worker" : "shared worker mode"],
  ["Services", services.map((service) => service.name).join(", ")],
]);
blank();
box([
  "Local endpoints",
  "  API         http://api.lvh.me  (localhost:3000)",
  "  Dashboard   http://dashboard.lvh.me/admin",
  "  Storefront  http://<handle>.lvh.me",
  "  Medusa      http://localhost:9000",
]);
blank();
info("Ctrl+C stops all processes");
blank();

if (groupedLogs) {
  await runGrouped(services);
} else {
  await runStreaming(services);
}

async function runStreaming(devCommands) {
  const { result } = concurrently(
    devCommands.map((service) => ({
      command: service.command,
      name: service.name,
      prefixColor: service.color,
    })),
    {
      killOthersOn: ["failure"],
      // Fixed-width name so columns line up: [12:04:01] api       message
      prefix: "[{time}] {name}",
      prefixColors: devCommands.map((service) => service.color),
      prefixLength: 10,
      restartTries: 0,
      timestampFormat: "HH:mm:ss",
    },
  );

  try {
    await result;
  } catch {
    process.exitCode = 1;
  }
}

async function runGrouped(devCommands) {
  const states = new Map(
    devCommands.map((command) => [
      command.name,
      {
        ...command,
        buffer: "",
        collapsed: 0,
        exitCode: undefined,
        lines: [],
        process: undefined,
        startedAt: Date.now(),
      },
    ]),
  );
  let shuttingDown = false;

  const exitPromises = [];
  const children = devCommands.map((command) => {
    const child = spawn(command.command, {
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const state = states.get(command.name);
    state.process = child;

    child.stdout.on("data", (chunk) => appendOutput(state, chunk));
    child.stderr.on("data", (chunk) => appendOutput(state, chunk));
    child.on("exit", (code, signal) => {
      state.exitCode = shuttingDown || signal ? 0 : (code ?? 0);

      if (!shuttingDown && state.exitCode !== 0) {
        shuttingDown = true;
        stopChildren(children, child);
      }
    });
    exitPromises.push(onceExit(child));

    return child;
  });

  const render = () => renderGroupedLogs(states);
  render();
  const renderTimer = setInterval(render, 400);

  const stop = () => {
    shuttingDown = true;
    stopChildren(children);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  await Promise.all(exitPromises);
  clearInterval(renderTimer);
  render();

  const failed = [...states.values()].some((state) => (state.exitCode ?? 0) !== 0);
  process.exitCode = failed ? 1 : 0;
}

function appendOutput(state, chunk) {
  state.buffer += chunk.toString();
  const parts = state.buffer.split(/\r?\n/);
  state.buffer = parts.pop() ?? "";

  for (const line of parts) {
    if (!line.trim()) continue;
    state.lines.push(line);
    if (state.lines.length > 10) {
      state.lines.shift();
      state.collapsed += 1;
    }
  }
}

function renderGroupedLogs(states) {
  const now = Date.now();
  process.stdout.write("\x1b[2J\x1b[H");
  process.stdout.write(`${color.bold("ECS development processes")}\n`);
  process.stdout.write(`${color.dim("Live tail · last 10 lines per service")}\n\n`);

  for (const state of states.values()) {
    const running = state.exitCode === undefined;
    const statusLabel = running
      ? color.green("running")
      : state.exitCode === 0
        ? color.dim("exited 0")
        : color.red(`exited ${state.exitCode}`);
    const elapsed = formatElapsed(now - state.startedAt);
    const collapsed =
      state.collapsed > 0 ? color.dim(` · ${state.collapsed} older lines hidden`) : "";

    process.stdout.write(
      `${color.bold(state.title.padEnd(16))} ${statusLabel}  ${color.dim(elapsed)}${collapsed}\n`,
    );

    if (state.lines.length === 0) {
      process.stdout.write(`  ${color.dim("waiting for output…")}\n`);
    } else {
      for (const line of state.lines) {
        process.stdout.write(`  ${color.dim("│")} ${line}\n`);
      }
    }
    process.stdout.write("\n");
  }
}

function formatElapsed(milliseconds) {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  if (minutes === 0) return `${remainder}s`;
  return `${minutes}m ${String(remainder).padStart(2, "0")}s`;
}

function stopChildren(children, except) {
  for (const child of children) {
    if (child === except || child.killed || child.exitCode !== null) continue;
    child.kill("SIGTERM");
  }
}

function onceExit(child) {
  return new Promise((resolve) => {
    child.once("exit", resolve);
  });
}
