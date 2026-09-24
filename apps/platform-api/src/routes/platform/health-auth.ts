import type { Hono } from "hono";
import type { PlatformAppOptions, PlatformAppVariables } from "../../app.js";

type PlatformHealthAuthDependencies = Pick<
  PlatformAppOptions,
  "authHandler" | "getSession" | "googleAuthEnabled" | "landingPublicOrigins" | "serviceName"
>;

export function registerPlatformHealthAuthRoutes(
  app: Hono<{ Variables: PlatformAppVariables }>,
  options: PlatformHealthAuthDependencies,
) {
  app.get("/platform/auth/providers", (context) => {
    context.header("cache-control", "public, max-age=60");
    return context.json({ google: options.googleAuthEnabled === true });
  });

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

  app.options("/platform/me", (context) => {
    const origin = context.req.header("origin");
    if (origin && options.landingPublicOrigins?.includes(origin)) {
      context.header("access-control-allow-credentials", "true");
      context.header("access-control-allow-origin", origin);
      context.header("vary", "Origin");
    }
    return context.body(null, 204);
  });

  app.get("/platform/me", async (context) => {
    context.header("cache-control", "private, no-store");
    const origin = context.req.header("origin");
    if (origin && options.landingPublicOrigins?.includes(origin)) {
      context.header("access-control-allow-credentials", "true");
      context.header("access-control-allow-origin", origin);
      context.header("vary", "Origin");
    }
    const session = await options.getSession?.(context.req.raw.headers);

    if (!session) {
      return context.json({ error: "auth_required" }, 401);
    }

    return context.json({
      user: session.user,
    });
  });
}
