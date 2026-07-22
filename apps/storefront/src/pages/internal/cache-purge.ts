import type { APIRoute } from "astro";

/**
 * Internal purge endpoint for storefront HTML cache.
 * Platform calls this after publish with a shared secret.
 *
 * Body: { "tags": ["tenant:…"] } or { "tenantId": "…" }
 */
export const POST: APIRoute = async (context) => {
  const expected = process.env.STOREFRONT_CACHE_PURGE_SECRET?.trim();
  const provided = context.request.headers.get("x-ecs-cache-purge-secret")?.trim();

  if (!expected || !provided || provided !== expected) {
    return new Response(JSON.stringify({ ok: false, error: "forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!context.cache?.enabled) {
    return new Response(JSON.stringify({ ok: true, purged: false, reason: "cache_disabled" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: { tags?: string[]; tenantId?: string } = {};
  try {
    body = (await context.request.json()) as typeof body;
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "invalid_json" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const tags = [...(body.tags ?? [])];
  if (body.tenantId?.trim()) {
    tags.push(`tenant:${body.tenantId.trim()}`);
  }

  if (!tags.length) {
    return new Response(JSON.stringify({ ok: false, error: "tags_required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  await context.cache.invalidate({ tags });

  return new Response(JSON.stringify({ ok: true, purged: true, tags }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
