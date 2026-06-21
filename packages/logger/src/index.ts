import pino from "pino";

export type LoggerOptions = {
  serviceName: string;
  environment?: string;
};

export function createLogger(options: LoggerOptions) {
  return pino({
    name: options.serviceName,
    level: process.env.LOG_LEVEL ?? "info",
    base: {
      service: options.serviceName,
      environment: options.environment ?? process.env.NODE_ENV ?? "development",
    },
  });
}
