import { loadServiceEnv } from "@ecs/config";
import { createLogger } from "@ecs/logger";
import { serve } from "@hono/node-server";
import { Hono } from "hono";

const env = loadServiceEnv({
  ...process.env,
  SERVICE_NAME: process.env.SERVICE_NAME ?? "platform-api",
});

const logger = createLogger({
  serviceName: env.SERVICE_NAME,
  environment: env.NODE_ENV,
});

const app = new Hono();

app.get("/health", (context) =>
  context.json({
    ok: true,
    service: env.SERVICE_NAME,
  }),
);

app.get("/platform/health", (context) =>
  context.json({
    ok: true,
    service: env.SERVICE_NAME,
  }),
);

app.all("/store/*", (context) =>
  context.json(
    {
      error: "shop_context_required",
    },
    400,
  ),
);

const port = Number.parseInt(process.env.PORT ?? "3000", 10);

serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    logger.info({ port: info.port }, "platform api listening");
  },
);
