import type { OperatorHealth } from "@ecs/contracts";

type Dependency = OperatorHealth["dependencies"][number];
type LiveDependencyId = Exclude<Dependency["id"], "platform_database">;

export function createDependencyHealthService(options: {
  checks: Partial<Record<LiveDependencyId, (() => Promise<void>) | null>>;
  now?: () => Date;
  timeoutMs?: number;
}) {
  return async (): Promise<OperatorHealth["dependencies"]> => {
    const checkedAt = (options.now?.() ?? new Date()).toISOString();
    const database: Dependency = {
      id: "platform_database",
      status: "operational",
      evidence: "request",
      checkedAt,
      latencyMs: null,
    };
    const live = await Promise.all(
      (["commerce_backend", "storefront_runtime", "job_queue", "media_storage"] as const).map(
        async (id): Promise<Dependency> => {
          const check = options.checks[id];
          if (!check) {
            return {
              id,
              status: "not_configured",
              evidence: "live_check",
              checkedAt,
              latencyMs: null,
            };
          }
          const startedAt = performance.now();
          try {
            await withTimeout(check(), options.timeoutMs ?? 2_500);
            return {
              id,
              status: "operational",
              evidence: "live_check",
              checkedAt,
              latencyMs: Math.max(0, Math.round(performance.now() - startedAt)),
            };
          } catch {
            return {
              id,
              status: "unavailable",
              evidence: "live_check",
              checkedAt,
              latencyMs: Math.max(0, Math.round(performance.now() - startedAt)),
            };
          }
        },
      ),
    );
    return [database, ...live];
  };
}

async function withTimeout(value: Promise<void>, timeoutMs: number) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      value,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("dependency_check_timeout")), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export function createHttpHealthCheck(
  url: string,
  options: { acceptAnyResponse?: boolean; timeoutMs?: number } = {},
) {
  return async () => {
    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(options.timeoutMs ?? 2_000),
    });
    if (!options.acceptAnyResponse && !response.ok) throw new Error("dependency_unavailable");
    if (options.acceptAnyResponse && response.status >= 500) {
      throw new Error("dependency_unavailable");
    }
  };
}
