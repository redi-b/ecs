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

function parseHttpUrl(value: string | null | undefined) {
  try {
    const parsed = new URL(value ?? "");
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed : null;
  } catch {
    return null;
  }
}
