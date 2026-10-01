import { createHash } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { renderDomainRoutes } from "./route-renderer.js";

type JsonRecord = Record<string, unknown>;
function record(value: unknown): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid provider response.");
  return value as JsonRecord;
}

/** Read-only, operator-configured internal API; never expose this API publicly. */
export function createTraefikRouteVerifier(options: {
  apiBaseUrl: string;
  routeOptions: Parameters<typeof renderDomainRoutes>[1];
  timeoutMs?: number;
  pollMs?: number;
  fetcher?: typeof fetch;
}) {
  const base = new URL(options.apiBaseUrl);
  if (
    !["http:", "https:"].includes(base.protocol) ||
    base.username ||
    base.password ||
    base.search ||
    base.hash ||
    base.pathname !== "/"
  ) {
    throw new Error("A trusted internal Traefik API origin is required.");
  }
  const timeoutMs = options.timeoutMs ?? 10000;
  const pollMs = options.pollMs ?? 250;
  if (
    !Number.isInteger(timeoutMs) ||
    timeoutMs < 1 ||
    timeoutMs > 30000 ||
    !Number.isInteger(pollMs) ||
    pollMs < 1 ||
    pollMs > 1000
  ) {
    throw new Error("Invalid provider verification deadline.");
  }
  const fetcher = options.fetcher ?? fetch;
  const json = async (path: string, budget: number): Promise<unknown> => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const operation = async () => {
      const response = await fetcher(new URL(path, base), {
        signal: controller.signal,
        redirect: "error",
        cache: "no-store",
        credentials: "omit",
      });
      if (!response.ok || !response.headers.get("content-type")?.includes("application/json"))
        throw new Error("Provider API unavailable.");
      const reader = response.body?.getReader();
      if (!reader) throw new Error("Empty provider response.");
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        for (;;) {
          const chunk = await reader.read();
          if (chunk.done) break;
          size += chunk.value.byteLength;
          if (size > 4 * 1024 * 1024) throw new Error("Provider response too large.");
          chunks.push(chunk.value);
        }
        return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
      } finally {
        void reader.cancel().catch(() => {});
      }
    };
    try {
      return await Promise.race([
        operation(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(new Error("Provider API deadline."));
          }, budget);
        }),
      ]);
    } finally {
      clearTimeout(timer);
      controller.abort();
    }
  };
  return async (hostnames: readonly string[]) => {
    const rendered = renderDomainRoutes(hostnames, options.routeOptions);
    const fingerprint = /ecs-domain-snapshot-([a-f0-9]{32}):/.exec(rendered)?.[1];
    if (!fingerprint) throw new Error("Missing route snapshot fingerprint.");
    const deadline = Date.now() + timeoutMs;
    do {
      try {
        const remaining = () => Math.max(1, Math.min(2000, deadline - Date.now()));
        const [routers, snapshot, redirect] = await Promise.all([
          json("/api/http/routers", remaining()),
          json(
            `/api/http/middlewares/${encodeURIComponent(`ecs-domain-snapshot-${fingerprint}@file`)}`,
            remaining(),
          ),
          json("/api/http/middlewares/ecs-domain-https-redirect%40file", remaining()),
        ]);
        if (Date.now() >= deadline) throw new Error("Provider verification expired.");
        const marker = record(snapshot);
        if (
          marker.status !== "enabled" ||
          record(record(marker.headers).customRequestHeaders)["X-ECS-Route-Snapshot"] !==
            fingerprint
        )
          throw new Error("Snapshot not loaded.");
        const redirectConfig = record(redirect);
        const scheme = record(redirectConfig.redirectScheme);
        if (
          redirectConfig.status !== "enabled" ||
          scheme.scheme !== "https" ||
          scheme.permanent !== true
        )
          throw new Error("Redirect not loaded.");
        if (!Array.isArray(routers)) throw new Error("Invalid router listing.");
        const owned = routers
          .map(record)
          .filter(
            (router) =>
              typeof router.name === "string" &&
              /^ecs-domain-[a-f0-9]{20}-(http|https)@file$/.test(router.name),
          );
        const hosts = [...new Set(hostnames)].sort();
        if (owned.length !== hosts.length * 2) throw new Error("Stale route set.");
        for (const hostname of hosts) {
          const id = createHash("sha256").update(hostname).digest("hex").slice(0, 20);
          for (const secure of [false, true]) {
            const router = owned.find(
              (candidate) =>
                candidate.name === `ecs-domain-${id}-${secure ? "https" : "http"}@file`,
            );
            if (
              !router ||
              router.status !== "enabled" ||
              router.rule !== `Host(\`${hostname}\`)` ||
              router.service !== options.routeOptions.service ||
              router.priority !== 100 ||
              JSON.stringify(router.entryPoints) !== JSON.stringify([secure ? "websecure" : "web"])
            )
              throw new Error("Route not loaded.");
            if (
              secure
                ? record(router.tls).certResolver !== options.routeOptions.resolver
                : JSON.stringify(router.middlewares) !==
                  JSON.stringify(["ecs-domain-https-redirect@file"])
            )
              throw new Error("Route policy not loaded.");
          }
        }
        return;
      } catch {
        const remaining = deadline - Date.now();
        if (remaining > 0) await delay(Math.min(pollMs, remaining));
      }
    } while (Date.now() < deadline);
    throw new Error(
      "Custom-domain route snapshot was not accepted by Traefik before the deadline.",
    );
  };
}
