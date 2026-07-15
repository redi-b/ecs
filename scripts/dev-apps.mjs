#!/usr/bin/env node
/**
 * Start local app processes (assumes infra + migrations already done).
 *
 *   pnpm dev:apps
 *   pnpm dev:apps --grouped
 *   pnpm dev:apps --split-medusa
 */
import { spawn } from "node:child_process";

import { blank, box, color, heading, info, kv, success } from "./lib/cli.mjs";
import { fitWidth, formatDevLogLine, stripAnsi, wrapLine } from "./lib/dev-log.mjs";

process.env.NODE_ENV = "development";
// Prefer human logs from Node services; child pino-pretty still works when installed.
if (process.env.LOG_PRETTY === undefined) {
  process.env.LOG_PRETTY = "1";
}

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
if (groupedLogs) {
  info("Grouped: larger per-service tails, wrapped lines, pretty JSON logs");
}
blank();

if (groupedLogs) {
  await runGrouped(services);
} else {
  await runStreaming(services);
}

async function runStreaming(devCommands) {
  const nameWidth = Math.max(...devCommands.map((service) => service.name.length));
  const states = spawnServices(devCommands);
  let shuttingDown = false;
  let forceKillTimer;

  const writeLine = (state, line) => {
    if (shuttingDown || !line.trim()) return;
    const formatted = formatDevLogLine(line) ?? line;
    const paint = color[state.color] ?? ((value) => value);
    const stamp = formatClock(new Date());
    const name = state.name.padEnd(nameWidth);
    process.stdout.write(`${paint(`[${stamp}] ${name}`)} ${formatted}\n`);
  };

  for (const state of states.values()) {
    state.process.stdout.on("data", (chunk) => appendStreamLines(state, chunk, writeLine));
    state.process.stderr.on("data", (chunk) => appendStreamLines(state, chunk, writeLine));
    state.process.on("exit", (code, signal) => {
      state.exitCode = shuttingDown || signal ? 0 : (code ?? 0);

      if (!shuttingDown && state.exitCode !== 0) {
        shuttingDown = true;
        info(`Stopping other processes (${state.name} exited ${state.exitCode})…`);
        stopAll(states);
      }
    });
  }

  const stop = () => {
    if (shuttingDown) {
      stopAll(states, "SIGKILL");
      return;
    }
    shuttingDown = true;
    clearInlineInterrupt();
    info("Stopping app processes…");
    stopAll(states);
    forceKillTimer = setTimeout(() => stopAll(states, "SIGKILL"), 4_000);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  await Promise.all([...states.values()].map((state) => onceExit(state.process)));
  clearTimeout(forceKillTimer);

  if (shuttingDown) {
    success("All app processes stopped");
    process.exitCode = 0;
    return;
  }

  const failed = [...states.values()].some((state) => (state.exitCode ?? 0) !== 0);
  process.exitCode = failed ? 1 : 0;
}

async function runGrouped(devCommands) {
  const states = spawnServices(devCommands);
  let shuttingDown = false;
  let forceKillTimer;

  for (const state of states.values()) {
    state.process.stdout.on("data", (chunk) => {
      if (!shuttingDown) appendGroupedOutput(state, chunk);
    });
    state.process.stderr.on("data", (chunk) => {
      if (!shuttingDown) appendGroupedOutput(state, chunk);
    });
    state.process.on("exit", (code, signal) => {
      state.exitCode = shuttingDown || signal ? 0 : (code ?? 0);

      if (!shuttingDown && state.exitCode !== 0) {
        shuttingDown = true;
        stopAll(states);
      }
    });
  }

  const leaveAltScreen = () => {
    if (!process.stdout.isTTY) return;
    process.stdout.write("\x1b[?25h\x1b[?1049l");
  };

  if (process.stdout.isTTY) {
    process.stdout.write("\x1b[?1049h\x1b[?25l\x1b[H\x1b[2J");
  }
  process.once("exit", leaveAltScreen);

  const render = () => {
    renderGroupedLogs(states);
  };
  render();
  const renderTimer = setInterval(render, 350);

  const stop = () => {
    if (shuttingDown) {
      stopAll(states, "SIGKILL");
      return;
    }
    shuttingDown = true;
    clearInlineInterrupt();
    stopAll(states);
    forceKillTimer = setTimeout(() => stopAll(states, "SIGKILL"), 4_000);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  // Re-render on resize so wrap width stays correct.
  process.stdout.on?.("resize", render);

  await Promise.all([...states.values()].map((state) => onceExit(state.process)));
  clearInterval(renderTimer);
  clearTimeout(forceKillTimer);
  render();
  leaveAltScreen();

  if (process.stdout.isTTY) {
    process.stdout.write(buildGroupedFrame(states, Date.now()).join("\n") + "\n");
  }

  if (shuttingDown) {
    success("All app processes stopped");
    process.exitCode = 0;
    return;
  }

  const failed = [...states.values()].some((state) => (state.exitCode ?? 0) !== 0);
  process.exitCode = failed ? 1 : 0;
}

function spawnServices(devCommands) {
  const states = new Map();

  for (const command of devCommands) {
    const child = spawn(command.command, {
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
      detached: process.platform !== "win32",
      env: {
        ...process.env,
        FORCE_COLOR: process.env.FORCE_COLOR ?? "1",
      },
    });

    states.set(command.name, {
      ...command,
      buffer: "",
      collapsed: 0,
      exitCode: undefined,
      // Keep a generous ring buffer; display count is computed from terminal size.
      lines: [],
      maxBuffer: 80,
      process: child,
      startedAt: Date.now(),
    });
  }

  return states;
}

function appendStreamLines(state, chunk, writeLine) {
  state.buffer += chunk.toString();
  const parts = state.buffer.split(/\r?\n/);
  state.buffer = parts.pop() ?? "";

  for (const part of parts) {
    if (!part.trim()) continue;
    writeLine(state, part);
  }
}

function appendGroupedOutput(state, chunk) {
  state.buffer += chunk.toString();
  const parts = state.buffer.split(/\r?\n/);
  state.buffer = parts.pop() ?? "";

  for (const part of parts) {
    const formatted = formatDevLogLine(part);
    if (!formatted) continue;
    state.lines.push(formatted);
    while (state.lines.length > state.maxBuffer) {
      state.lines.shift();
      state.collapsed += 1;
    }
  }
}

function linesPerService(serviceCount) {
  const rows = process.stdout.rows || 40;
  // header + per-service title/blank overhead
  const overhead = 4 + serviceCount * 3;
  const available = Math.max(12, rows - overhead);
  return Math.max(6, Math.floor(available / Math.max(serviceCount, 1)));
}

function renderGroupedLogs(states) {
  const frame = buildGroupedFrame(states, Date.now());

  if (!process.stdout.isTTY) {
    process.stdout.write(frame.join("\n") + "\n");
    return;
  }

  // Full redraw on alt-screen (stable; avoids partial-row glitches).
  process.stdout.write(`\x1b[H\x1b[2J${frame.join("\n")}\n`);
}

function buildGroupedFrame(states, now) {
  const columns = process.stdout.columns || 100;
  const perService = linesPerService(states.size);
  const lines = [];
  lines.push(fitWidth(color.bold("ECS development processes"), columns));
  lines.push(
    fitWidth(
      color.dim(
        `Live tail · ~${perService} lines/service · pretty JSON · Ctrl+C to stop`,
      ),
      columns,
    ),
  );
  lines.push("");

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

    lines.push(
      fitWidth(
        `${color.bold(state.title.padEnd(16))} ${statusLabel}  ${color.dim(elapsed)}${collapsed}`,
        columns,
      ),
    );

    const recent = state.lines.slice(-perService);
    if (recent.length === 0) {
      lines.push(fitWidth(`  ${color.dim("waiting for output…")}`, columns));
    } else {
      for (const line of recent) {
        // Wrap long lines instead of truncating the start/middle into noise.
        const wrapped = wrapLine(line, columns, {
          prefix: `  ${color.dim("│")} `,
          contPrefix: `  ${color.dim("│")} `,
        });
        for (const row of wrapped) {
          lines.push(row);
        }
      }
    }
    lines.push("");
  }

  while (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }

  // If the frame is taller than the terminal, keep the bottom (most recent sections).
  const maxRows = (process.stdout.rows || 40) - 1;
  if (lines.length > maxRows) {
    return [
      fitWidth(color.dim(`… ${lines.length - maxRows + 1} rows above (resize terminal for more)`), columns),
      ...lines.slice(-(maxRows - 1)),
    ];
  }

  return lines;
}

function formatElapsed(milliseconds) {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  if (minutes === 0) return `${remainder}s`;
  return `${minutes}m ${String(remainder).padStart(2, "0")}s`;
}

function formatClock(date) {
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function clearInlineInterrupt() {
  if (process.stdout.isTTY) {
    process.stdout.write("\r\x1b[2K");
  }
}

function stopAll(states, signal = "SIGTERM") {
  for (const state of states.values()) {
    killTree(state.process, signal);
  }
}

function killTree(child, signal = "SIGTERM") {
  if (!child?.pid || child.exitCode !== null || child.signalCode) return;

  try {
    if (process.platform !== "win32") {
      process.kill(-child.pid, signal);
      return;
    }
    child.kill(signal);
  } catch {
    try {
      child.kill(signal);
    } catch {
      // Already gone.
    }
  }
}

function onceExit(child) {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode) {
      resolve();
      return;
    }
    child.once("exit", resolve);
  });
}
