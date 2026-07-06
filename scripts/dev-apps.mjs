import { spawn } from "node:child_process";
import concurrently from "concurrently";

process.env.NODE_ENV = "development";

const args = new Set(process.argv.slice(2));
const groupedLogs = args.has("--grouped") || process.env.DEV_LOG_MODE === "grouped";
const splitMedusa = args.has("--split-medusa") || process.env.MEDUSA_DEV_MODE === "split";

const commands = [
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
    command: splitMedusa ? "pnpm --filter @ecs/medusa dev:server" : "pnpm --filter @ecs/medusa dev",
  },
  ...(splitMedusa
    ? [
        {
          name: "medusa-worker",
          command: "pnpm --filter @ecs/medusa dev:worker",
        },
      ]
    : []),
];

if (groupedLogs) {
  await runGrouped(commands);
} else {
  await runStreaming(commands);
}

async function runStreaming(devCommands) {
  const { result } = concurrently(devCommands, {
    prefix: "[{time}] [{name}]",
    prefixColors: ["cyan", "yellow", "magenta", "blue", "green", "gray"],
    killOthersOn: ["failure"],
    restartTries: 0,
    timestampFormat: "HH:mm:ss",
  });

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
  const renderTimer = setInterval(render, 500);

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
    if (!line.trim()) {
      continue;
    }

    state.lines.push(line);

    if (state.lines.length > 8) {
      state.lines.shift();
      state.collapsed += 1;
    }
  }
}

function renderGroupedLogs(states) {
  const now = Date.now();
  process.stdout.write("\x1b[2J\x1b[H");
  process.stdout.write("ECS development processes\n\n");

  for (const state of states.values()) {
    const status = state.exitCode === undefined ? "running" : `exited ${state.exitCode}`;
    const elapsed = formatElapsed(now - state.startedAt);
    const collapsed = state.collapsed > 0 ? `, ${state.collapsed} lines collapsed` : "";
    process.stdout.write(`${state.name} ${status} ${elapsed}${collapsed}\n`);

    if (state.lines.length === 0) {
      process.stdout.write("  waiting for output...\n");
    } else {
      for (const line of state.lines) {
        process.stdout.write(`  ${line}\n`);
      }
    }

    process.stdout.write("\n");
  }
}

function formatElapsed(milliseconds) {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;

  if (minutes === 0) {
    return `${remainder}s`;
  }

  return `${minutes}m ${remainder}s`;
}

function stopChildren(children, except) {
  for (const child of children) {
    if (child === except || child.killed || child.exitCode !== null) {
      continue;
    }

    child.kill("SIGTERM");
  }
}

function onceExit(child) {
  return new Promise((resolve) => {
    child.once("exit", resolve);
  });
}
