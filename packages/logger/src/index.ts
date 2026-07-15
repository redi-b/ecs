import pino from "pino";

export type LoggerOptions = {
  serviceName: string;
  environment?: string;
};

function isDevelopment(environment?: string) {
  const env = environment ?? process.env.NODE_ENV ?? "development";
  return env === "development" || env === "test";
}

/**
 * Structured logger.
 *
 * Under `pnpm dev:apps` / grouped mode, the supervisor sets LOG_PRETTY=0 so
 * children emit JSON and the parent reformats with colors (child stdout is a
 * pipe, so pino-pretty colors would die anyway).
 *
 * Standalone `pnpm --filter @ecs/platform-api dev` still uses pino-pretty.
 */
export function createLogger(options: LoggerOptions) {
  const environment = options.environment ?? process.env.NODE_ENV ?? "development";
  const pretty =
    isDevelopment(environment) &&
    process.env.LOG_PRETTY !== "0" &&
    process.env.LOG_PRETTY !== "false";

  return pino({
    name: options.serviceName,
    level: process.env.LOG_LEVEL ?? (isDevelopment(environment) ? "debug" : "info"),
    base: {
      service: options.serviceName,
      environment,
    },
    ...(pretty
      ? {
          transport: {
            target: "pino-pretty",
            options: {
              colorize: true,
              translateTime: "HH:MM:ss",
              ignore: "pid,hostname,service,environment",
              singleLine: true,
              hideObject: true,
              messageFormat: "{msg}",
            },
          },
        }
      : {}),
  });
}
