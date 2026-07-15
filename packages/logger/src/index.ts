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
 * Structured logger. In development, uses pino-pretty for human-readable
 * colored lines unless LOG_PRETTY=0.
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
              colorize: process.env.NO_COLOR === undefined,
              translateTime: "HH:MM:ss",
              ignore: "pid,hostname",
              singleLine: true,
              messageFormat: "{msg}",
            },
          },
        }
      : {}),
  });
}
