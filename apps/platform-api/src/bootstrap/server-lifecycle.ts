import type { createLogger } from "@ecs/logger";
import { serve } from "@hono/node-server";

type PlatformLogger = Pick<ReturnType<typeof createLogger>, "error" | "info">;
type PlatformFetch = Parameters<typeof serve>[0]["fetch"];

type Closable = {
  close(): Promise<unknown>;
};

type PlatformServerLifecycleOptions = {
  fetch: PlatformFetch;
  jobsClient: Closable | null;
  logger: PlatformLogger;
  onBeforeClose?: () => void;
  platformDbPool: {
    end(): Promise<unknown>;
  };
  port: number;
};

export function startPlatformServer(options: PlatformServerLifecycleOptions) {
  let closing = false;
  let server: ReturnType<typeof serve> | undefined;

  const shutdown = async (signal: NodeJS.Signals) => {
    if (closing) {
      return;
    }
    closing = true;
    options.logger.info({ signal }, "platform api shutting down");
    options.onBeforeClose?.();

    try {
      await new Promise<void>((resolve, reject) => {
        if (!server?.listening) {
          resolve();
          return;
        }
        server.close((error) => (error ? reject(error) : resolve()));
      });
      await options.jobsClient?.close();
      await options.platformDbPool.end();
    } catch (error) {
      options.logger.error({ err: error }, "error during platform api shutdown");
      process.exitCode = 1;
    }
  };

  process.once("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.once("SIGTERM", () => {
    void shutdown("SIGTERM");
  });

  server = serve(
    {
      fetch: options.fetch,
      port: options.port,
    },
    (info) => {
      options.logger.info({ port: info.port }, "platform api listening");
    },
  );
  return server;
}
