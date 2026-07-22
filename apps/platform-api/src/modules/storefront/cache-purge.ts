/**
 * Best-effort purge of storefront HTML cache after publish/unpublish.
 * Failures are logged and ignored so publish still succeeds.
 */
export async function purgeStorefrontTenantCache(input: {
  tenantId: string;
  fetcher?: typeof fetch;
  logger?: { warn: (msg: string, meta?: Record<string, unknown>) => void };
}): Promise<{ ok: boolean; skipped?: boolean; status?: number }> {
  const baseUrl =
    process.env.STOREFRONT_INTERNAL_BASE_URL?.trim() ||
    process.env.STOREFRONT_BASE_URL?.trim() ||
    "http://localhost:4321";
  const secret = process.env.STOREFRONT_CACHE_PURGE_SECRET?.trim();

  if (!secret) {
    // Dev-friendly: no secret configured → skip purge.
    return { ok: true, skipped: true };
  }

  const url = new URL("/internal/cache-purge", baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
  const fetcher = input.fetcher ?? fetch;

  try {
    const response = await fetcher(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-ecs-cache-purge-secret": secret,
      },
      body: JSON.stringify({
        tenantId: input.tenantId,
        tags: [`tenant:${input.tenantId}`],
      }),
    });

    if (!response.ok) {
      input.logger?.warn("storefront_cache_purge_failed", {
        tenantId: input.tenantId,
        status: response.status,
      });
      return { ok: false, status: response.status };
    }

    return { ok: true, status: response.status };
  } catch (error) {
    input.logger?.warn("storefront_cache_purge_error", {
      tenantId: input.tenantId,
      message: error instanceof Error ? error.message : String(error),
    });
    return { ok: false };
  }
}
