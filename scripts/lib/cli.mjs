/**
 * Shared CLI helpers for monorepo scripts (logging, steps, subprocesses).
 * Respects NO_COLOR / FORCE_COLOR.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const useColor =
  process.env.FORCE_COLOR !== "0" &&
  process.env.NO_COLOR === undefined &&
  Boolean(process.stdout.isTTY);

const wrap =
  (open, close = "\x1b[0m") =>
  (value) =>
    useColor ? `${open}${value}${close}` : String(value);

export const color = {
  bold: wrap("\x1b[1m"),
  dim: wrap("\x1b[2m"),
  red: wrap("\x1b[31m"),
  green: wrap("\x1b[32m"),
  yellow: wrap("\x1b[33m"),
  blue: wrap("\x1b[34m"),
  magenta: wrap("\x1b[35m"),
  cyan: wrap("\x1b[36m"),
  gray: wrap("\x1b[90m"),
};

export function log(message = "") {
  console.log(message);
}

export function info(message) {
  console.log(`${color.cyan("→")} ${message}`);
}

export function success(message) {
  console.log(`${color.green("✓")} ${message}`);
}

export function warn(message) {
  console.warn(`${color.yellow("!")} ${message}`);
}

export function error(message) {
  console.error(`${color.red("✗")} ${message}`);
}

export function heading(title) {
  console.log("");
  console.log(color.bold(title));
  console.log(color.dim("─".repeat(Math.min(56, Math.max(title.length, 24)))));
}

export function blank() {
  console.log("");
}

/** Fixed-width step progress: [2/5] label */
export function step(current, total, label) {
  const index = color.dim(`[${current}/${total}]`);
  console.log(`${index} ${label}`);
}

export function formatMs(ms) {
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60);
  return `${minutes}m ${remainder}s`;
}

/**
 * Run a command with inherited stdio. Exits the process on failure unless throwOnError.
 * @returns {{ status: number, durationMs: number, stdout?: string }}
 */
export function run(command, args = [], options = {}) {
  const {
    capture = false,
    cwd,
    env = process.env,
    label,
    throwOnError = false,
  } = options;

  const started = Date.now();
  if (label) info(label);

  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env,
    shell: process.platform === "win32",
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
  });

  const durationMs = Date.now() - started;
  const status = result.status ?? 1;
  const stdout = capture ? `${result.stdout ?? ""}${result.stderr ?? ""}` : undefined;

  if (status !== 0) {
    if (capture && stdout) process.stderr.write(stdout);
    const message = `Command failed (${status}): ${command} ${args.join(" ")}`.trim();
    if (throwOnError) {
      const err = new Error(message);
      err.status = status;
      throw err;
    }
    error(message);
    process.exit(status);
  }

  return { durationMs, status, stdout };
}

export function runPnpm(args, options = {}) {
  return run("pnpm", args, options);
}

/** Load MEDUSA_ADMIN_API_TOKEN from apps/platform-api/.env if not already set. */
export function loadMedusaAdminTokenFromEnvFile() {
  if (process.env.MEDUSA_ADMIN_API_TOKEN?.trim()) {
    return process.env.MEDUSA_ADMIN_API_TOKEN.trim();
  }

  const path = resolve("apps/platform-api/.env");
  if (!existsSync(path)) return undefined;

  const match = readFileSync(path, "utf8").match(/^MEDUSA_ADMIN_API_TOKEN=(.+)$/m);
  const value = match?.[1]?.trim().replace(/^["']|["']$/g, "");
  if (value) {
    process.env.MEDUSA_ADMIN_API_TOKEN = value;
    return value;
  }
  return undefined;
}

/** Print a simple two-column key/value block. */
export function kv(rows, { indent = "  " } = {}) {
  const width = Math.max(...rows.map(([key]) => key.length), 0);
  for (const [key, value] of rows) {
    console.log(`${indent}${color.dim(key.padEnd(width))}  ${value}`);
  }
}

export function box(lines) {
  const content = lines.filter((line) => line !== undefined && line !== null).map(String);
  const width = Math.min(72, Math.max(40, ...content.map((line) => line.length)));
  const top = `┌${"─".repeat(width + 2)}┐`;
  const bottom = `└${"─".repeat(width + 2)}┘`;
  console.log(color.dim(top));
  for (const line of content) {
    const padded = line.padEnd(width);
    console.log(`${color.dim("│")} ${padded} ${color.dim("│")}`);
  }
  console.log(color.dim(bottom));
}
