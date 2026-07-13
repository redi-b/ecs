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
  const nameWidth = Math.max(...devCommands.map((service) => service.name.length));
  const states = spawnServices(devCommands);
  let shuttingDown = false;
  let forceKillTimer;

  const writeLine = (state, line) => {
    if (shuttingDown || !line.trim()) return;
    const paint = color[state.color] ?? ((value) => value);
    const stamp = formatClock(new Date());
    const name = state.name.padEnd(nameWidth);
    process.stdout.write(`${paint(`[${stamp}] ${name}`)} ${line}\n`);
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
      // Second Ctrl+C — force kill immediately.
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
  /** Rows currently painted by the live dashboard (for in-place redraw). */
  let paintedRows = 0;
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
    // Show cursor + leave alternate screen (restores prior scrollback).
    process.stdout.write("\x1b[?25h\x1b[?1049l");
  };

  // Alternate screen buffer: live UI never pollutes the main terminal scrollback.
  if (process.stdout.isTTY) {
    process.stdout.write("\x1b[?1049h\x1b[?25l\x1b[H\x1b[2J");
  }
  process.once("exit", leaveAltScreen);

  const render = () => {
    paintedRows = renderGroupedLogs(states, paintedRows);
  };
  render();
  const renderTimer = setInterval(render, 400);

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

  await Promise.all([...states.values()].map((state) => onceExit(state.process)));
  clearInterval(renderTimer);
  clearTimeout(forceKillTimer);
  render();
  leaveAltScreen();

  // Final snapshot on the main screen (one clean block, no live redraw history).
  if (process.stdout.isTTY) {
    process.stdout.write(buildGroupedFrame(states, Date.now(), process.stdout.columns || 80).join("\n") + "\n");
  }

  if (shuttingDown) {
    success("All app processes stopped");
    process.exitCode = 0;
    return;
  }

  const failed = [...states.values()].some((state) => (state.exitCode ?? 0) !== 0);
  process.exitCode = failed ? 1 : 0;
}

/**
 * Spawn each service in its own process group so Ctrl+C hits only this
 * supervisor — children get a quiet SIGTERM instead of printing SIGINT noise.
 */
function spawnServices(devCommands) {
  const states = new Map();

  for (const command of devCommands) {
    const child = spawn(command.command, {
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
      // New session/process group on POSIX so the terminal's SIGINT process
      // group does not include the child trees.
      detached: process.platform !== "win32",
    });

    states.set(command.name, {
      ...command,
      buffer: "",
      collapsed: 0,
      exitCode: undefined,
      lines: [],
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
    const line = stripAnsi(part).replace(/\r/g, "");
    if (!line.trim()) continue;
    writeLine(state, line);
  }
}

function appendGroupedOutput(state, chunk) {
  state.buffer += chunk.toString();
  const parts = state.buffer.split(/\r?\n/);
  state.buffer = parts.pop() ?? "";

  for (const line of parts) {
    if (!line.trim()) continue;
    // Strip child ANSI / CR so our frame stays one terminal row per log line.
    state.lines.push(stripAnsi(line).replace(/\r/g, ""));
    if (state.lines.length > 10) {
      state.lines.shift();
      state.collapsed += 1;
    }
  }
}

/**
 * Redraw the live dashboard on the alternate screen buffer.
 * Home + clear + rewrite keeps scrollback clean (no frame history).
 *
 * @returns {number} row count of the frame just painted
 */
function renderGroupedLogs(states, previousRows) {
  const now = Date.now();
  const columns = process.stdout.columns || 80;
  const frame = buildGroupedFrame(states, now, columns);

  if (!process.stdout.isTTY) {
    // Non-TTY (piped logs): print a full snapshot once per tick.
    process.stdout.write(frame.join("\n") + "\n");
    return frame.length;
  }

  // On alt-screen, full clear is fine — it never hits the user's main scrollback.
  void previousRows;
  process.stdout.write(`\x1b[H\x1b[J${frame.join("\n")}\n`);
  return frame.length;
}

function buildGroupedFrame(states, now, columns) {
  const lines = [];
  lines.push(fitWidth(color.bold("ECS development processes"), columns));
  lines.push(fitWidth(color.dim("Live tail · last 10 lines per service"), columns));
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

    if (state.lines.length === 0) {
      lines.push(fitWidth(`  ${color.dim("waiting for output…")}`, columns));
    } else {
      for (const line of state.lines) {
        lines.push(fitWidth(`  ${color.dim("│")} ${line}`, columns));
      }
    }
    lines.push("");
  }

  // Drop trailing blank so we don't leave an extra empty row every tick.
  while (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }

  return lines;
}

/** Visible length without ANSI SGR sequences. */
function stripAnsi(value) {
  return value.replace(/\x1b\[[0-9;]*m/g, "");
}

/** Truncate a (possibly colored) line so it fits one terminal row. */
function fitWidth(line, columns) {
  const plain = stripAnsi(line);
  if (plain.length <= columns) return line;
  // Prefer truncating the raw string; if colors remain unbalanced the next
  // \x1b[2K redraw resets the line anyway.
  const keep = Math.max(0, columns - 1);
  let visible = 0;
  let out = "";
  for (let i = 0; i < line.length; i++) {
    if (line[i] === "\x1b") {
      const end = line.indexOf("m", i);
      if (end === -1) break;
      out += line.slice(i, end + 1);
      i = end;
      continue;
    }
    if (visible >= keep) break;
    out += line[i];
    visible += 1;
  }
  return `${out}…`;
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

/** Clear the terminal's echoed `^C` on the current line. */
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
      // Negative PID targets the process group created via detached: true.
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
