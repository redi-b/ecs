/**
 * Multi-tenant Redis HTML cache provider for Astro 7.
 *
 * Cache keys always include Host / x-forwarded-host so two shops on `/`
 * never share entries. Pages opt in via `Astro.cache.set({ maxAge, tags })`.
 */
import type { CacheProviderFactory } from "astro";
import Redis from "ioredis";

type ProviderConfig = {
  redisUrl?: string;
  prefix?: string;
};

type CacheSetOptions = {
  maxAge?: number;
  swr?: number;
  tags?: string[];
};

const PRIVATE_PATH_PREFIXES = ["/cart", "/checkout", "/order", "/actions", "/cart-count", "/internal"];

function isPrivatePath(pathname: string) {
  return PRIVATE_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function requestHost(request: Request) {
  return (
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    request.headers.get("host")?.trim() ||
    "unknown"
  );
}

function htmlCacheKey(prefix: string, request: Request) {
  const url = new URL(request.url);
  const host = requestHost(request).toLowerCase();
  return `${prefix}:html:${host}:${url.pathname}${url.search}`;
}

const factory: CacheProviderFactory = (rawConfig) => {
  const config = (rawConfig ?? {}) as ProviderConfig;
  const prefix = config.prefix?.trim() || "ecs:sf:cache";
  const redisUrl = config.redisUrl?.trim() || process.env.REDIS_URL || "redis://localhost:6379";

  let client: Redis | null = null;
  let disabled = false;

  function redis() {
    if (disabled) return null;
    if (!client) {
      client = new Redis(redisUrl, {
        maxRetriesPerRequest: 1,
        enableReadyCheck: false,
        lazyConnect: true,
        // Avoid hanging SSR when Redis is down.
        connectTimeout: 1500,
      });
      client.on("error", () => {
        /* logged by ioredis; we fail open */
      });
    }
    return client;
  }

  async function safeRedis<T>(fn: (r: Redis) => Promise<T>): Promise<T | null> {
    const r = redis();
    if (!r) return null;
    try {
      if (r.status !== "ready") {
        await r.connect().catch(() => {
          /* ignore — get/set will throw */
        });
      }
      return await fn(r);
    } catch {
      return null;
    }
  }

  return {
    name: "ecs-redis-cache",

    setHeaders(options: CacheSetOptions) {
      const headers = new Headers();
      if (options.maxAge !== undefined) {
        let value = `public, s-maxage=${options.maxAge}, max-age=0`;
        if (options.swr !== undefined) {
          value += `, stale-while-revalidate=${options.swr}`;
        }
        headers.set("Cache-Control", value);
      }
      if (options.tags?.length) {
        headers.set("Cache-Tag", options.tags.join(","));
      }
      return headers;
    },

    async onRequest(context, next) {
      const { request } = context;
      if (request.method !== "GET" && request.method !== "HEAD") {
        return next();
      }

      const url = new URL(request.url);
      if (isPrivatePath(url.pathname)) {
        return next();
      }

      const key = htmlCacheKey(prefix, request);
      const hit = await safeRedis((r) => r.get(key));
      if (hit != null) {
        return new Response(request.method === "HEAD" ? null : hit, {
          status: 200,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "public, s-maxage=60, max-age=0, stale-while-revalidate=60",
            "X-ECS-Cache": "HIT",
          },
        });
      }

      const response = await next();

      // Astro types for custom provider context may lag behind runtime cache API.
      const opts = (context as { cache?: { options?: CacheSetOptions } }).cache
        ?.options;
      if (
        !opts ||
        opts.maxAge == null ||
        opts.maxAge <= 0 ||
        !response.ok ||
        request.method !== "GET"
      ) {
        return response;
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("text/html")) {
        return response;
      }

      try {
        const body = await response.clone().text();
        const ttl = Math.max(30, (opts.maxAge ?? 60) + (opts.swr ?? 0));
        await safeRedis(async (r) => {
          const pipeline = r.pipeline();
          pipeline.set(key, body, "EX", ttl);
          for (const tag of opts.tags ?? []) {
            const tagKey = `${prefix}:tag:${tag}`;
            pipeline.sadd(tagKey, key);
            pipeline.expire(tagKey, 60 * 60 * 24 * 7);
          }
          await pipeline.exec();
        });
      } catch {
        /* fail open */
      }

      const headers = new Headers(response.headers);
      if (!headers.has("X-ECS-Cache")) {
        headers.set("X-ECS-Cache", "MISS");
      }
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    },

    async invalidate(options: { tags?: string[]; path?: string }) {
      await safeRedis(async (r) => {
        if (options.tags?.length) {
          for (const tag of options.tags) {
            const tagKey = `${prefix}:tag:${tag}`;
            const keys = await r.smembers(tagKey);
            if (keys.length > 0) {
              await r.del(...keys);
            }
            await r.del(tagKey);
          }
        }

        // Path-only purge is host-ambiguous in multi-tenant; require tags.
        if (options.path && !options.tags?.length) {
          // Best-effort: scan is avoided; no-op for path-only.
        }
      });
    },
  };
};

export default factory;
