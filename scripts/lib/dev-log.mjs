/**
 * Helpers for local multi-service log streaming / grouped dashboard.
 *
 * Child processes are piped (non-TTY), so their own colors often die.
 * Prefer JSON from Node loggers and recolor/format here in the parent TTY.
 */
import { color } from "./cli.mjs";

/** Visible length without ANSI SGR sequences. */
export function stripAnsi(value) {
  return String(value).replace(/\x1b\[[0-9;]*m/g, "");
}

/**
 * Format a raw process log line for developer reading.
 * - Pretty-prints pino JSON into a short colored line
 * - Parses pino-pretty leftovers that still dump trailing JSON
 * - Preserves ANSI on other lines (Next, Vite, Medusa)
 */
export function formatDevLogLine(rawLine) {
  const original = String(rawLine).replace(/\r/g, "").trimEnd();
  const plain = stripAnsi(original);
  if (!plain.trim()) return null;

  // Pure pino JSON (preferred when LOG_PRETTY=0 under the supervisor)
  if (plain.startsWith("{")) {
    try {
      const obj = JSON.parse(plain);
      if (obj && typeof obj === "object" && (obj.msg != null || obj.message != null || obj.level != null)) {
        return formatPinoLine(obj);
      }
    } catch {
      // fall through
    }
  }

  // pino-pretty style: [11:23:15] INFO (platform-api): message {...json}
  const pretty = plain.match(
    /^\[([^\]]+)\]\s+([A-Z]+)\s+(?:\(([^)]+)\):\s*)?(.*)$/,
  );
  if (pretty) {
    const [, timeToken, levelToken, , rest] = pretty;
    const parsed = splitMessageAndJson(rest);
    if (parsed.obj) {
      return formatPinoLine({
        ...parsed.obj,
        msg: parsed.obj.msg ?? parsed.obj.message ?? parsed.message,
        level: levelFromName(levelToken),
        time: parsed.obj.time ?? timeToken,
      });
    }
    // Pretty line without trailing object — recolor levels
    return [
      color.dim(timeToken),
      paintLevel(levelToken.toLowerCase()),
      parsed.message,
    ]
      .filter(Boolean)
      .join(" ");
  }

  // Keep original colors from Next/Vite/Medusa when present
  return original;
}

function splitMessageAndJson(rest) {
  const text = rest.trim();
  // Trailing JSON object (pino-pretty singleLine dumps extra fields this way)
  const brace = text.lastIndexOf(" {");
  if (brace >= 0) {
    const maybeJson = text.slice(brace + 1).trim();
    if (maybeJson.startsWith("{") && maybeJson.endsWith("}")) {
      try {
        return {
          message: text.slice(0, brace).trim(),
          obj: JSON.parse(maybeJson),
        };
      } catch {
        // fall through
      }
    }
  }
  if (text.startsWith("{") && text.endsWith("}")) {
    try {
      return { message: "", obj: JSON.parse(text) };
    } catch {
      // fall through
    }
  }
  return { message: text, obj: null };
}

function levelFromName(name) {
  const key = String(name).toLowerCase();
  if (key === "fatal") return 60;
  if (key === "error") return 50;
  if (key === "warn" || key === "warning") return 40;
  if (key === "info") return 30;
  if (key === "debug") return 20;
  if (key === "trace") return 10;
  return 30;
}

function paintLevel(level) {
  const label = level.padEnd(5);
  if (level === "error" || level === "fatal") return color.red(label);
  if (level === "warn") return color.yellow(label);
  if (level === "debug" || level === "trace") return color.gray(label);
  return color.cyan(label);
}

function formatPinoLine(obj) {
  const levelNum = typeof obj.level === "number" ? obj.level : levelFromName(String(obj.level ?? "info"));
  const level =
    levelNum >= 50 ? "error" : levelNum >= 40 ? "warn" : levelNum >= 30 ? "info" : "debug";

  let time = "";
  if (typeof obj.time === "number") {
    time = new Date(obj.time).toLocaleTimeString(undefined, { hour12: false });
  } else if (typeof obj.time === "string") {
    const d = new Date(obj.time);
    // pino-pretty times like "11:23:15" are already local clock strings
    time = Number.isNaN(d.getTime()) ? obj.time.replace(/[\[\]]/g, "") : d.toLocaleTimeString(undefined, { hour12: false });
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

  // HTTP access log — compact colored one-liner
  if (msg === "http_request" || (obj.method && obj.path != null && obj.status != null)) {
    const status = Number(obj.status);
    const statusPaint =
      status >= 500 ? color.red : status >= 400 ? color.yellow : color.green;
    const method = color.bold(String(obj.method ?? "?").padEnd(6));
    const path = String(obj.path ?? "");
    const ms = obj.ms != null ? color.dim(`${obj.ms}ms`) : "";
    return [time ? color.dim(time) : null, paintLevel(level), method, path, statusPaint(String(status)), ms]
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
    paintLevel(level),
    msg || color.dim("(no message)"),
    extras.length ? color.dim(extras.slice(0, 5).join(" ")) : null,
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Truncate a (possibly colored) line so it fits one terminal row.
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
 * Soft-wrap a colored line into multiple terminal rows.
 * Long dumps lose ANSI on wrap (acceptable).
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

  const rows = [];
  let remaining = plain;
  let first = true;
  while (remaining.length > 0) {
    const max = first ? maxFirst : maxCont;
    if (remaining.length <= max) {
      rows.push(`${first ? prefix : contPrefix}${remaining}`);
      break;
    }
    let cut = remaining.lastIndexOf(" ", max);
    if (cut < max * 0.5) cut = max;
    rows.push(`${first ? prefix : contPrefix}${remaining.slice(0, cut)}`);
    remaining = remaining.slice(cut).trimStart();
    first = false;
  }
  return rows;
}
