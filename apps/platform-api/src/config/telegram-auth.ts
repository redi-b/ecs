export type TelegramAuthConfiguration =
  | {
      clientId: string;
      clientSecret: string;
      enabled: true;
      status: "enabled";
    }
  | {
      enabled: false;
      status: "disabled" | "not_configured";
    };

export function resolveTelegramAuthConfiguration(
  env: NodeJS.ProcessEnv,
): TelegramAuthConfiguration {
  const setting = env.TELEGRAM_AUTH_ENABLED?.trim().toLowerCase() || "auto";
  if (setting !== "auto" && setting !== "true" && setting !== "false") {
    throw new Error("TELEGRAM_AUTH_ENABLED must be true, false, or auto");
  }

  const clientId = env.TELEGRAM_AUTH_CLIENT_ID?.trim();
  const clientSecret = env.TELEGRAM_AUTH_CLIENT_SECRET?.trim();
  const hasClientId = Boolean(clientId);
  const hasClientSecret = Boolean(clientSecret);

  if (setting === "false") return { enabled: false, status: "disabled" };
  if (hasClientId !== hasClientSecret) {
    throw new Error(
      "TELEGRAM_AUTH_CLIENT_ID and TELEGRAM_AUTH_CLIENT_SECRET must be configured together",
    );
  }
  if (!hasClientId || !hasClientSecret) {
    if (setting === "true") {
      throw new Error(
        "TELEGRAM_AUTH_ENABLED is true but TELEGRAM_AUTH_CLIENT_ID and TELEGRAM_AUTH_CLIENT_SECRET are missing",
      );
    }
    return { enabled: false, status: "not_configured" };
  }

  return {
    clientId: clientId as string,
    clientSecret: clientSecret as string,
    enabled: true,
    status: "enabled",
  };
}
