"use client";

import { AppIcons, type AppIcon } from "@/components/app/icons";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/provider";
import { parseDeviceFromUserAgent } from "@/lib/device-from-user-agent";

export type DeviceInfo = {
  browser: string;
  BrowserIcon: AppIcon;
  deviceLabel: string;
  DeviceIcon: AppIcon;
  os: string;
  OsIcon: AppIcon;
};

export function PasswordField({
  autoComplete,
  description,
  id,
  label,
  onChange,
  onToggle,
  value,
  visible,
}: {
  autoComplete: string;
  description?: string | undefined;
  id: string;
  label: string;
  onChange: (value: string) => void;
  onToggle: () => void;
  value: string;
  visible: boolean;
}) {
  const { t } = useI18n();
  // Eye = password is hidden (click to show). Eye-off = password is visible (click to hide).
  const PasswordIcon = visible ? AppIcons.eyeOff : AppIcons.eye;
  const tip = visible
    ? t("settings.accountSecurity.hidePassword")
    : t("settings.accountSecurity.showPassword");

  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <InputGroup>
        <InputGroupInput
          autoComplete={autoComplete}
          id={id}
          onChange={(event) => onChange(event.target.value)}
          type={visible ? "text" : "password"}
          value={value}
        />
        <InputGroupAddon align="inline-end">
          <Tooltip>
            <TooltipTrigger asChild>
              <InputGroupButton
                aria-label={tip}
                onClick={onToggle}
                size="icon-xs"
                type="button"
              >
                <PasswordIcon />
              </InputGroupButton>
            </TooltipTrigger>
            <TooltipContent>{tip}</TooltipContent>
          </Tooltip>
        </InputGroupAddon>
      </InputGroup>
      {description ? <FieldDescription>{description}</FieldDescription> : null}
    </Field>
  );
}

export function parseUserAgent(
  userAgent: string | null,
  t: (key: MessageKey) => string,
): DeviceInfo {
  const parsed = parseDeviceFromUserAgent(userAgent, {
    browser: t("settings.accountSecurity.os.unknownBrowser"),
    deviceLabel: t("settings.accountSecurity.device.unknown"),
    os: t("settings.accountSecurity.os.unknown"),
  });

  // Map form factor / known names back onto localized labels when we recognize them.
  let deviceLabel = parsed.deviceLabel;
  if (parsed.form === "unknown") {
    deviceLabel = t("settings.accountSecurity.device.unknown");
  } else if (parsed.deviceLabel === "iPad") {
    deviceLabel = t("settings.accountSecurity.device.ipad");
  } else if (parsed.deviceLabel === "iPhone") {
    deviceLabel = t("settings.accountSecurity.device.iphone");
  } else if (parsed.deviceLabel === "Android phone") {
    deviceLabel = t("settings.accountSecurity.device.androidPhone");
  } else if (parsed.deviceLabel === "Android tablet") {
    deviceLabel = t("settings.accountSecurity.device.androidTablet");
  } else if (parsed.deviceLabel === "Mac") {
    deviceLabel = t("settings.accountSecurity.device.mac");
  } else if (parsed.deviceLabel === "Windows PC") {
    deviceLabel = t("settings.accountSecurity.device.windowsPc");
  } else if (parsed.deviceLabel === "Linux PC") {
    deviceLabel = t("settings.accountSecurity.device.linuxPc");
  } else if (parsed.deviceLabel === "Mobile device" || parsed.deviceLabel === "Tablet") {
    deviceLabel = t("settings.accountSecurity.device.mobile");
  } else if (parsed.deviceLabel === "Desktop") {
    deviceLabel = t("settings.accountSecurity.device.desktop");
  }

  let browser = parsed.browser;
  if (parsed.browserKind === "unknown") {
    browser = t("settings.accountSecurity.os.unknownBrowser");
  } else if (parsed.browserKind === "other") {
    browser = t("settings.accountSecurity.os.browser");
  }

  const DeviceIcon: AppIcon =
    parsed.form === "phone" || parsed.form === "tablet"
      ? AppIcons.smartphone
      : parsed.form === "desktop"
        ? parsed.osKind === "macos"
          ? AppIcons.macbook
          : AppIcons.computer
        : AppIcons.global;

  const OsIcon: AppIcon =
    parsed.osKind === "ios" || parsed.osKind === "macos"
      ? AppIcons.apple
      : parsed.osKind === "android"
        ? AppIcons.android
        : parsed.osKind === "windows"
          ? AppIcons.windows
          : parsed.osKind === "linux"
            ? AppIcons.ubuntu
            : AppIcons.global;

  const BrowserIcon: AppIcon =
    parsed.browserKind === "chrome"
      ? AppIcons.chrome
      : parsed.browserKind === "safari"
        ? AppIcons.safari
        : parsed.browserKind === "firefox"
          ? AppIcons.firefox
          : parsed.browserKind === "edge"
            ? AppIcons.edge
            : AppIcons.global;

  return {
    browser,
    BrowserIcon,
    deviceLabel,
    DeviceIcon,
    os: parsed.osKind === "unknown" ? t("settings.accountSecurity.os.unknown") : parsed.os,
    OsIcon,
  };
}

export function formatDateTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatSessionIp(
  ip: string | null,
  t: (key: MessageKey) => string,
) {
  if (!ip?.trim()) return t("settings.accountSecurity.unknown");
  const value = ip.trim();
  if (value === "127.0.0.1" || value === "::1" || value === "localhost") {
    return t("settings.accountSecurity.localIp");
  }
  return value;
}

export function getInitials(value: string) {
  const [first = "", second = ""] = value
    .split(/[\s@._-]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  return `${first.charAt(0)}${second.charAt(0) || first.charAt(1) || ""}`.toUpperCase() || "?";
}
