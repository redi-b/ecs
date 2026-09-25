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

export function resolveGoogleAuthConfiguration(env: NodeJS.ProcessEnv) {
  const setting = env.GOOGLE_AUTH_ENABLED?.trim().toLowerCase() || "auto";
  if (setting !== "auto" && setting !== "true" && setting !== "false") {
    throw new Error("GOOGLE_AUTH_ENABLED must be true, false, or auto");
  }

  const clientId = env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim();
  const hasClientId = Boolean(clientId);
  const hasClientSecret = Boolean(clientSecret);

  if (setting === "false") {
    return { enabled: false, status: "disabled" as const };
  }
  if (hasClientId !== hasClientSecret) {
    throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be configured together");
  }
  if (!hasClientId || !hasClientSecret) {
    if (setting === "true") {
      throw new Error(
        "GOOGLE_AUTH_ENABLED is true but GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are missing",
      );
    }
    return { enabled: false, status: "not_configured" as const };
  }

  return {
    clientId: clientId as string,
    clientSecret: clientSecret as string,
    enabled: true,
    status: "enabled" as const,
  };
}

export function createAuthRuntime(options: AuthRuntimeOptions) {
  const baseUrl = options.env.BETTER_AUTH_URL ?? "http://api.lvh.me";
  const google = resolveGoogleAuthConfiguration(options.env);
  const auth = createPlatformAuth({
    baseUrl,
    cookieDomain: options.env.BETTER_AUTH_COOKIE_DOMAIN,
    cookiePrefix: options.env.BETTER_AUTH_COOKIE_PREFIX,
    dashboardPublicBaseUrl: options.env.DASHBOARD_PUBLIC_BASE_URL ?? "http://app.lvh.me",
    db: options.db,
    googleClientId: google.clientId,
    googleClientSecret: google.clientSecret,
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
    googleAuthEnabled: google.enabled,
    googleAuthStatus: google.status,
    merchantTeamService: createMerchantTeamService({
      authHandler: auth.handler,
      db: options.db,
    }),
  };
}
