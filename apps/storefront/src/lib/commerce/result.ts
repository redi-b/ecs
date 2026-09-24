import type { StorefrontError } from "./types.js";

export function isStoreError(value: unknown): value is StorefrontError {
  return typeof value === "object" && value !== null && "ok" in value && (value as { ok: unknown }).ok === false;
}
