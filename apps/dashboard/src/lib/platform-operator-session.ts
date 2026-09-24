export async function isPlatformOperatorSession(options: {
  cookieHeader: string;
  fetcher?: typeof fetch;
  platformApiBaseUrl: string;
}) {
  const fetcher = options.fetcher ?? fetch;
  const response = await fetcher(
    new URL("/platform/operator/session", normalizeBaseUrl(options.platformApiBaseUrl)),
    {
      cache: "no-store",
      headers: {
        accept: "application/json",
        cookie: options.cookieHeader,
      },
    },
  ).catch(() => null);

  if (!response?.ok) return false;
  const body = (await response.json().catch(() => null)) as { principalId?: unknown } | null;
  return typeof body?.principalId === "string" && body.principalId.length > 0;
}

function normalizeBaseUrl(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}
