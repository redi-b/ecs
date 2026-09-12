export type ShutdownLogger = {
  error?: (fields: Record<string, unknown>, message?: string) => void;
  info?: (fields: Record<string, unknown>, message?: string) => void;
  warn?: (fields: Record<string, unknown>, message?: string) => void;
};

export type ShutdownStep = {
  name: string;
  run: () => Promise<void> | void;
};

export type ShutdownOutcome = "completed" | "forced" | "timed_out";

export function parseShutdownDeadlineMs(value: string | undefined, fallback = 30_000) {
  if (!Number.isFinite(fallback) || fallback < 1) {
    throw new Error("Shutdown deadline fallback must be positive");
  }
  if (!value?.trim()) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function createShutdownController(options: {
  deadlineMs: number;
  force?: () => Promise<void> | void;
  logger?: ShutdownLogger;
  now?: () => number;
  steps: readonly ShutdownStep[];
}) {
  if (!Number.isFinite(options.deadlineMs) || options.deadlineMs < 1) {
    throw new Error("Shutdown deadline must be a positive number");
  }

  let active: Promise<ShutdownOutcome> | null = null;
  let forced = false;
  let settled: ShutdownOutcome | null = null;

  return {
    request(signal: string): Promise<ShutdownOutcome> {
      if (settled) return Promise.resolve(settled);
      if (active) {
        if (!forced) {
          forced = true;
          options.logger?.warn?.({ signal }, "Second shutdown signal received");
          void options.force?.();
        }
        return Promise.resolve("forced");
      }

      const startedAt = options.now?.() ?? Date.now();
      options.logger?.info?.({ deadlineMs: options.deadlineMs, signal }, "Shutdown started");
      active = runWithDeadline(options, startedAt).then((outcome) => {
        settled = outcome;
        active = null;
        return outcome;
      });
      return active;
    },
    get active() {
      return active !== null;
    },
  };
}

async function runWithDeadline(
  options: {
    deadlineMs: number;
    logger?: ShutdownLogger;
    now?: () => number;
    steps: readonly ShutdownStep[];
  },
  startedAt: number,
): Promise<ShutdownOutcome> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const work = (async () => {
    for (const step of options.steps) {
      options.logger?.info?.({ step: step.name }, "Shutdown step started");
      await step.run();
    }
    return "completed" as const;
  })();

  const deadline = new Promise<"timed_out">((resolve) => {
    timer = setTimeout(() => resolve("timed_out"), options.deadlineMs);
  });

  try {
    const outcome = await Promise.race([work, deadline]);
    const elapsedMs = (options.now?.() ?? Date.now()) - startedAt;
    if (outcome === "timed_out") {
      options.logger?.error?.({ elapsedMs }, "Shutdown deadline exceeded");
    } else {
      options.logger?.info?.({ elapsedMs }, "Shutdown completed");
    }
    return outcome;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
