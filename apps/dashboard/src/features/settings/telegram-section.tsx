"use client";

import { useEffect, useState } from "react";

import {
  SectionIntro,
  SettingsSectionBody,
} from "@/features/settings/settings-sections";
import { TelegramShopToolsPanel } from "@/features/settings/telegram-shop-tools-panel";
import { useI18n } from "@/i18n/provider";

export function TelegramSection({ tenantId }: { tenantId: string }) {
  const { t } = useI18n();
  const [available, setAvailable] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(
          `/admin/settings/notifications?tenantId=${encodeURIComponent(tenantId)}`,
          { headers: { accept: "application/json" }, cache: "no-store" },
        );
        const data = await response.json().catch(() => undefined);
        if (cancelled || !response.ok) return;
        const channels = data?.channels as
          | { email?: { available?: boolean }; telegram?: { available?: boolean } }
          | undefined;
        setAvailable(channels?.telegram?.available !== false);
      } catch {
        // Keep default available; panel will surface errors on load.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  return (
    <SettingsSectionBody>
      <SectionIntro
        description={t("settings.telegram.intro")}
        title={t("settings.sections.telegram.label")}
      />
      <TelegramShopToolsPanel available={available} tenantId={tenantId} />
    </SettingsSectionBody>
  );
}
