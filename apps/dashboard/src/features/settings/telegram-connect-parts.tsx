"use client";

import { AppIcons } from "@/components/app/icons";
import { Badge } from "@/components/ui/badge";
import type { TelegramDestination } from "@/lib/platform-api/notifications/telegram-client";
import { useI18n } from "@/i18n/provider";

import { formatConnectedAt, telegramProfileUrl } from "./telegram-connect-helpers";

export function DestinationIdentity({ destination }: { destination: TelegramDestination }) {
  const { t, locale } = useI18n();
  const username = destination.username?.replace(/^@/, "").trim() || null;
  const profileUrl = username ? telegramProfileUrl(username) : null;
  const showUsernameBesideLabel =
    username !== null &&
    destination.label.replace(/^@/, "").toLowerCase() !== username.toLowerCase();

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {profileUrl && !showUsernameBesideLabel ? (
          <a
            className="inline-flex max-w-full items-center gap-1 truncate text-sm font-semibold text-foreground underline-offset-4 hover:underline"
            href={profileUrl}
            rel="noreferrer"
            target="_blank"
          >
            <span className="truncate">{destination.label}</span>
            <AppIcons.externalLink className="size-3 shrink-0 opacity-60" />
          </a>
        ) : (
          <p className="truncate text-sm font-semibold">{destination.label}</p>
        )}
        {profileUrl && showUsernameBesideLabel ? (
          <a
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            href={profileUrl}
            rel="noreferrer"
            target="_blank"
          >
            @{username}
            <AppIcons.externalLink className="size-3 shrink-0 opacity-60" />
          </a>
        ) : null}
        <Badge variant={destination.enabled ? "secondary" : "outline"}>
          {destination.enabled
            ? t("settings.notifications.telegramPanel.active")
            : t("settings.notifications.telegramPanel.paused")}
        </Badge>
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {formatConnectedAt(
          destination.connectedAt,
          locale,
          t("settings.notifications.telegramPanel.connectedRecently"),
          t("settings.notifications.telegramPanel.connectedAt"),
        )}
      </p>
    </div>
  );
}
