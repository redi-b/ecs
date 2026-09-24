import type { StorefrontLocale, StorefrontLocalizedContent } from "@ecs/contracts";

export function applyLocalizedContent<T>(input: {
  content: StorefrontLocalizedContent;
  defaults?: Record<string, { source: string; value: string }>;
  locale: StorefrontLocale;
  source: T;
  prefix?: string;
}): T {
  const fields = input.content.locales[input.locale];
  if ((!fields && !input.defaults) || input.source == null) return input.source;
  const result = structuredClone(input.source);
  const prefix = input.prefix ? `${input.prefix}.` : "";

  for (const [fieldId, translation] of Object.entries(input.defaults ?? {})) {
    if (prefix && !fieldId.startsWith(prefix)) continue;
    const path = (prefix ? fieldId.slice(prefix.length) : fieldId).split(".");
    if (getStringAtPath(input.source, path) === translation.source) {
      setStringAtPath(result, path, translation.value);
    }
  }

  for (const [fieldId, translation] of Object.entries(fields ?? {})) {
    if (prefix && !fieldId.startsWith(prefix)) continue;
    const path = (prefix ? fieldId.slice(prefix.length) : fieldId).split(".");
    setStringAtPath(result, path, translation.value);
  }

  return result;
}

function getStringAtPath(value: unknown, path: string[]) {
  let current = value;
  for (const segment of path) {
    if (!current || typeof current !== "object") return undefined;
    current = Array.isArray(current)
      ? current[Number(segment)]
      : (current as Record<string, unknown>)[segment];
  }
  return typeof current === "string" ? current : undefined;
}

function setStringAtPath(value: unknown, path: string[], translatedValue: string) {
  if (!value || typeof value !== "object" || path.length === 0) return;
  let current: unknown = value;
  for (const segment of path.slice(0, -1)) {
    if (!current || typeof current !== "object") return;
    const next = Array.isArray(current)
      ? current[Number(segment)]
      : (current as Record<string, unknown>)[segment];
    if (!next || typeof next !== "object") return;
    current = next;
  }
  const leaf = path.at(-1);
  if (!leaf || !current || typeof current !== "object") return;
  if (Array.isArray(current)) {
    const index = Number(leaf);
    if (Number.isInteger(index) && typeof current[index] === "string") {
      current[index] = translatedValue;
    }
    return;
  }
  const record = current as Record<string, unknown>;
  if (typeof record[leaf] === "string") record[leaf] = translatedValue;
}
