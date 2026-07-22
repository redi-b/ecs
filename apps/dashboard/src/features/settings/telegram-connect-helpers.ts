import { mapPlatformErrorMessage } from "@/lib/platform-api/errors";

export function connectSteps(
  t: (
    key:
      | "settings.notifications.telegramPanel.step1"
      | "settings.notifications.telegramPanel.step2"
      | "settings.notifications.telegramPanel.step3",
  ) => string,
) {
  return [
    t("settings.notifications.telegramPanel.step1"),
    t("settings.notifications.telegramPanel.step2"),
    t("settings.notifications.telegramPanel.step3"),
  ] as const;
}

export type ConnectSession = {
  id: string;
  status: string;
  expiresAt: string;
  deepLink: string | null;
};

export function apiError(data: unknown, fallback: string) {
  if (typeof data === "object" && data !== null) {
    const rec = data as { error?: unknown; message?: unknown };
    if (typeof rec.error === "string") {
      return mapPlatformErrorMessage(rec.error);
    }
    if (typeof rec.message === "string") {
      return mapPlatformErrorMessage(rec.message);
    }
  }
  return mapPlatformErrorMessage(fallback);
}

export function telegramProfileUrl(username: string) {
  const clean = username.replace(/^@/, "").trim();
  if (!clean) return null;
  return `https://t.me/${encodeURIComponent(clean)}`;
}

export function formatConnectedAt(
  iso: string,
  locale: string,
  recentLabel: string,
  connectedPrefix: string,
) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return recentLabel;
  return `${connectedPrefix} ${date.toLocaleString(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  })}`;
}
