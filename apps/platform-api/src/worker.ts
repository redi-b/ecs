import { loadServiceEnv } from "@ecs/config";
import { createLogger } from "@ecs/logger";

const env = loadServiceEnv({
  ...process.env,
  SERVICE_NAME: process.env.SERVICE_NAME ?? "platform-worker",
});

const logger = createLogger({
  serviceName: env.SERVICE_NAME,
  environment: env.NODE_ENV,
});

logger.info("platform worker placeholder started");

setInterval(() => {
  logger.debug("platform worker heartbeat");
}, 30_000);
