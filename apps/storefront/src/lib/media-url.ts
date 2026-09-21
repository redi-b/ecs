export function normalizeStorefrontMediaUrl(
  value: string | null | undefined,
  publicBaseUrl = process.env.MEDIA_S3_PUBLIC_BASE_URL,
) {
  const candidate = value?.trim();
  if (!candidate) return null;
  if (candidate.startsWith("/") && !candidate.startsWith("//")) return candidate;

  const trustedBase = parseHttpUrl(
    publicBaseUrl ??
      (process.env.NODE_ENV === "development" ? "http://localhost:9002/ecs-media" : undefined),
  );
  const parsed = parseHttpUrl(candidate);
  if (!trustedBase || !parsed) return null;
  const basePath = trustedBase.pathname.replace(/\/+$/, "");
  const matchesPath = parsed.pathname === basePath || parsed.pathname.startsWith(`${basePath}/`);
  return parsed.origin === trustedBase.origin && matchesPath ? parsed.toString() : null;
}

export type StorefrontMediaVariantWidth = 96 | 400 | 800 | 1200;

export function resolveStorefrontMediaVariantUrl(
  value: string | null | undefined,
  width: StorefrontMediaVariantWidth,
  publicBaseUrl = process.env.MEDIA_S3_PUBLIC_BASE_URL,
): string | null {
  const normalized = normalizeStorefrontMediaUrl(value, publicBaseUrl);
  if (!normalized) return null;

  const lower = normalized.toLowerCase();
  if (lower.endsWith(".gif") || lower.endsWith(".svg")) return normalized;

  const match = normalized.match(/^(.*\/tenants\/[^/]+\/.+\/)([^/?#]+)(\?.*)?$/);
  if (!match) return normalized;

  const prefix = match[1];
  const search = match[3] ?? "";
  return `${prefix}w${width}.webp${search}`;
}

export function buildStorefrontMediaSrcset(
  value: string | null | undefined,
  widths: readonly StorefrontMediaVariantWidth[] = [400, 800, 1200],
  publicBaseUrl = process.env.MEDIA_S3_PUBLIC_BASE_URL,
): string | null {
  const normalized = normalizeStorefrontMediaUrl(value, publicBaseUrl);
  if (!normalized) return null;

  const lower = normalized.toLowerCase();
  if (lower.endsWith(".gif") || lower.endsWith(".svg")) return null;

  const match = normalized.match(/^(.*\/tenants\/[^/]+\/.+\/)([^/?#]+)(\?.*)?$/);
  if (!match) return null;

  return widths
    .map((w) => `${resolveStorefrontMediaVariantUrl(normalized, w, publicBaseUrl)} ${w}w`)
    .join(", ");
}

function parseHttpUrl(value: string | null | undefined) {
  try {
    const parsed = new URL(value ?? "");
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed : null;
  } catch {
    return null;
  }
}

