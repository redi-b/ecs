/** Shared limits for remote media URL import (must match upload restrictions). */
export const MEDIA_URL_IMPORT_MAX_BYTES = 15 * 1024 * 1024;
export const MEDIA_URL_IMPORT_ALLOWED_TYPES = new Set([
  "image/avif",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export function isAllowedMediaImportMime(mimeType: string) {
  const base = mimeType.split(";")[0]?.trim().toLowerCase() ?? "";
  return MEDIA_URL_IMPORT_ALLOWED_TYPES.has(base);
}

export function filenameFromUrl(url: string, mimeType: string) {
  try {
    const pathname = new URL(url).pathname;
    const base = pathname.split("/").filter(Boolean).pop() ?? "";
    if (base && /\.[a-z0-9]{2,5}$/i.test(base)) {
      return decodeURIComponent(base).slice(0, 180);
    }
  } catch {
    // fall through
  }
  const ext =
    mimeType === "image/png"
      ? "png"
      : mimeType === "image/webp"
        ? "webp"
        : mimeType === "image/gif"
          ? "gif"
          : mimeType === "image/avif"
            ? "avif"
            : "jpg";
  return `imported-image.${ext}`;
}

/** Block obvious private/reserved hosts before fetch (defense in depth). */
export function assertPublicHttpUrl(raw: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    throw new Error("invalid_url");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("invalid_url");
  }

  const host = parsed.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host === "[::1]"
  ) {
    throw new Error("private_url");
  }

  // IPv4 private / link-local / loopback
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
    if (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    ) {
      throw new Error("private_url");
    }
  }

  // IPv6 unique local / link-local prefixes (simple checks)
  if (host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80")) {
    throw new Error("private_url");
  }

  return parsed;
}
