/**
 * Helpers for local multi-service log streaming / grouped dashboard.
 */
import { color } from "./cli.mjs";

/** Visible length without ANSI SGR sequences. */
export function stripAnsi(value) {
  return String(value).replace(/\x1b\[[0-9;]*m/g, "");
}

/**
 * Format a raw process log line for developer reading.
 * - Pretty-prints pino JSON into a short colored line
 * - Leaves other lines (Next, Medusa) mostly intact
 */
export function formatDevLogLine(rawLine) {
  const plain = stripAnsi(rawLine).replace(/\r/g, "").trimEnd();
  if (!plain.trim()) return null;

  // pino / structured JSON logs
  if (plain.startsWith("{") && plain.includes('"level"') && plain.includes('"time"')) {
    try {
      return formatPinoLine(JSON.parse(plain));
    } catch {
      // fall through
    }
  }

  // Single-line compact JSON without pretty transport
  if (plain.startsWith("{") && plain.length > 2) {
    try {
      const obj = JSON.parse(plain);
      if (obj && typeof obj === "object" && (obj.msg || obj.message || obj.level != null)) {
        return formatPinoLine(obj);
      }
    } catch {
      // fall through
    }
  }

  return plain;
}

function formatPinoLine(obj) {
  const levelNum = typeof obj.level === "number" ? obj.level : 30;
  const level =
    levelNum >= 50 ? "error" : levelNum >= 40 ? "warn" : levelNum >= 30 ? "info" : "debug";
  const levelPaint =
    level === "error"
      ? color.red
      : level === "warn"
        ? color.yellow
        : level === "debug"
          ? color.gray
          : color.cyan;

  let time = "";
  if (typeof obj.time === "number") {
    time = new Date(obj.time).toLocaleTimeString(undefined, { hour12: false });
  } else if (typeof obj.time === "string") {
    const d = new Date(obj.time);
    time = Number.isNaN(d.getTime())
      ? obj.time
      : d.toLocaleTimeString(undefined, { hour12: false });
  }

  const msg = String(obj.msg ?? obj.message ?? "").trim();
  const skip = new Set([
    "level",
    "time",
    "pid",
    "hostname",
    "name",
    "service",
    "environment",
    "msg",
    "message",
    "v",
  ]);

  // Prefer a short field summary for HTTP access logs.
  if (msg === "http_request" || (obj.method && obj.path && obj.status != null)) {
    const status = Number(obj.status);
    const statusPaint =
      status >= 500 ? color.red : status >= 400 ? color.yellow : color.green;
    const method = String(obj.method ?? "?").padEnd(6);
    const path = String(obj.path ?? "");
    const ms = obj.ms != null ? `${obj.ms}ms` : "";
    return [
      time ? color.dim(time) : null,
      levelPaint(level.padEnd(5)),
      color.bold(method),
      path,
      statusPaint(String(status)),
      ms ? color.dim(ms) : null,
    ]
      .filter(Boolean)
      .join(" ");
  }

  const extras = [];
  for (const [key, value] of Object.entries(obj)) {
    if (skip.has(key)) continue;
    if (value == null) continue;
    if (typeof value === "object") {
      try {
        extras.push(`${key}=${JSON.stringify(value)}`);
      } catch {
        extras.push(`${key}=[object]`);
      }
    } else {
      extras.push(`${key}=${value}`);
    }
  }

  return [
    time ? color.dim(time) : null,
    levelPaint(level.padEnd(5)),
    msg || color.dim("(no message)"),
    extras.length ? color.dim(extras.slice(0, 6).join(" ")) : null,
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Truncate a (possibly colored) line so it fits one terminal row.
 * Keeps ANSI sequences intact when possible.
 */
export function fitWidth(line, columns) {
  const plain = stripAnsi(line);
  if (plain.length <= columns) return line;
  const keep = Math.max(8, columns - 1);
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
  return `${out}${color.dim("…")}`;
}

/**
 * Soft-wrap a colored line into multiple terminal rows (indent continuation).
 */
export function wrapLine(line, columns, options = {}) {
  const prefix = options.prefix ?? "";
  const contPrefix = options.contPrefix ?? prefix;
  const maxFirst = Math.max(16, columns - stripAnsi(prefix).length);
  const maxCont = Math.max(16, columns - stripAnsi(contPrefix).length);
  const plain = stripAnsi(line);

  if (plain.length <= maxFirst) {
    return [`${prefix}${line}`];
  }

  // Wrap on the plain text, re-apply no colors on wraps (acceptable for long dumps).
  const rows = [];
  let remaining = plain;
  let first = true;
  while (remaining.length > 0) {
    const max = first ? maxFirst : maxCont;
    if (remaining.length <= max) {
      rows.push(`${first ? prefix : contPrefix}${remaining}`);
      break;
    }
    // Prefer break at space.
    let cut = remaining.lastIndexOf(" ", max);
    if (cut < max * 0.5) cut = max;
    rows.push(`${first ? prefix : contPrefix}${remaining.slice(0, cut)}`);
    remaining = remaining.slice(cut).trimStart();
    first = false;
  }
  return rows;
}
