import type { CacheProviderConfig } from "astro";

export type EcsRedisCacheOptions = {
  /** Redis connection URL. Defaults to REDIS_URL or redis://localhost:6379 */
  redisUrl?: string;
  /** Key prefix for HTML entries and tag sets */
  prefix?: string;
};

/**
 * Config helper for Astro `cache.provider`.
 * Runtime lives in `./ecs-redis-cache-provider.ts` (bundled with SSR output).
 */
export function ecsRedisCache(options: EcsRedisCacheOptions = {}): CacheProviderConfig {
  return {
    // Resolved from the storefront app root (where astro.config.mjs lives).
    entrypoint: "./src/cache/ecs-redis-cache-provider.ts",
    config: {
      redisUrl: options.redisUrl ?? process.env.REDIS_URL ?? "redis://localhost:6379",
      prefix: options.prefix ?? "ecs:sf:cache",
    },
  };
}
