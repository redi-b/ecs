import type { Hono } from "hono";
import type { PlatformAppOptions, PlatformAppVariables } from "../../app.js";

export function registerPlatformHealthAuthRoutes(
  app: Hono<{ Variables: PlatformAppVariables }>,
  options: PlatformAppOptions,
) {

  if (options.authHandler) {
    const authHandler = options.authHandler;

    app.on(["GET", "POST"], "/platform/auth/*", (context) => authHandler(context.req.raw));
  }

  app.get("/health", (context) =>
    context.json({
      ok: true,
      service: options.serviceName,
    }),
  );

  app.get("/platform/health", (context) =>
    context.json({
      ok: true,
      service: options.serviceName,
    }),
  );


  app.get("/platform/me", async (context) => {
    const session = await options.getSession?.(context.req.raw.headers);

    if (!session) {
      return context.json({ error: "auth_required" }, 401);
    }

    return context.json({
      user: session.user,
    });
  });


}
