import type { createPlatformDb } from "@ecs/db";
import { createPlatformAuth, parseTrustedOrigins } from "../context/platform-auth.js";
import { createMerchantTeamService } from "../modules/team/merchant-team-service.js";

type EmailRuntime = ReturnType<typeof import("./email.js").createEmailRuntime>;

type AuthRuntimeOptions = {
  authEmailProvider: EmailRuntime["emailProvider"];
  db: ReturnType<typeof createPlatformDb>["db"];
  emailDeliveryService: EmailRuntime["emailDeliveryService"];
  env: NodeJS.ProcessEnv;
  requireEmailVerification: boolean;
};

export function createAuthRuntime(options: AuthRuntimeOptions) {
  const baseUrl = options.env.BETTER_AUTH_URL ?? "http://api.lvh.me";
  const auth = createPlatformAuth({
    baseUrl,
    cookieDomain: options.env.BETTER_AUTH_COOKIE_DOMAIN,
    cookiePrefix: options.env.BETTER_AUTH_COOKIE_PREFIX,
    dashboardPublicBaseUrl: options.env.DASHBOARD_PUBLIC_BASE_URL ?? "http://app.lvh.me",
    db: options.db,
    ...(!options.emailDeliveryService && options.authEmailProvider
      ? { emailProvider: options.authEmailProvider }
      : {}),
    ...(options.emailDeliveryService
      ? { enqueueAccountEmail: options.emailDeliveryService.enqueue }
      : {}),
    requireEmailVerification: options.requireEmailVerification,
    secret:
      options.env.BETTER_AUTH_SECRET ?? "development-ecs-auth-secret-change-before-production",
    trustedOrigins: parseTrustedOrigins(options.env.BETTER_AUTH_TRUSTED_ORIGINS) ?? [
      "http://api.lvh.me",
      "http://app.lvh.me",
      "http://dashboard.lvh.me",
      "http://*.lvh.me",
      "http://*.lvh.me:3001",
      "http://localhost:3001",
      "http://127.0.0.1:3001",
    ],
    useSecureCookies: baseUrl.startsWith("https://"),
  });

  return {
    auth,
    merchantTeamService: createMerchantTeamService({
      authHandler: auth.handler,
      db: options.db,
    }),
  };
}
