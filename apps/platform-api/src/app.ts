import { Hono } from "hono";

import { registerAllRoutes } from "./routes/index.js";
import type { PlatformAppOptions, PlatformAppVariables } from "./types/platform-app.js";

export type * from "./types/index.js";

function createRequestId() {
  return crypto.randomUUID();
}

async function maybeAttachRequestIdToErrorBody(response: Response, requestId: string) {
  if (
    response.status < 400 ||
    !response.headers.get("content-type")?.includes("application/json")
  ) {
    return response;
  }

  const data = await response
    .clone()
    .json()
    .catch(() => undefined);

  if (typeof data !== "object" || data === null || !("error" in data) || "requestId" in data) {
    return response;
  }

  return new Response(
    JSON.stringify({
      ...data,
      requestId,
    }),
    {
      headers: response.headers,
      status: response.status,
      statusText: response.statusText,
    },
  );
}

export function createPlatformApp(options: PlatformAppOptions) {
  const app = new Hono<{ Variables: PlatformAppVariables }>();
  const medusaStoreFetch = options.medusaStoreFetch ?? fetch;

  app.use("*", async (context, next) => {
    const incomingRequestId = context.req.raw.headers.get("x-request-id")?.trim();
    const requestId = incomingRequestId || createRequestId();
    context.set("requestId", requestId);

    await next();

    context.res.headers.set("x-request-id", requestId);

    if (incomingRequestId && !new URL(context.req.raw.url).pathname.startsWith("/store/")) {
      context.res = await maybeAttachRequestIdToErrorBody(context.res, requestId);
      context.res.headers.set("x-request-id", requestId);
    }
  });

  registerAllRoutes(app, options, medusaStoreFetch);

  return app;
}
