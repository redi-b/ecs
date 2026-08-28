"use client";

import type { TenantDomainContract } from "@ecs/contracts";

import { AppIcons } from "@/components/app/icons";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  SectionIntro,
  SettingsPanel,
  SettingsSectionBody,
} from "@/features/settings/settings-sections";
import { useI18n } from "@/i18n/provider";

export function DomainsSection({ initialDomains }: { initialDomains: TenantDomainContract[] }) {
  const { t } = useI18n();

  return (
    <SettingsSectionBody>
      <SectionIntro
        description={t("settings.domains.intro")}
        title={t("settings.sections.domains.label")}
      />

      <SettingsPanel
        description={t("settings.domains.unavailableDescription")}
        title={t("settings.domains.unavailableTitle")}
      >
        <p className="text-sm text-muted-foreground">
          {t("settings.domains.unavailableNote")}
        </p>
      </SettingsPanel>

      <div className="space-y-3">
        {initialDomains.map((domain) => (
          <Card className="border-border/80" key={domain.id}>
            <CardHeader className="flex-row items-start justify-between gap-4">
              <div className="min-w-0">
                <CardTitle className="truncate text-base">{domain.hostname}</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  {domain.type === "platform_subdomain"
                    ? t("settings.domains.ecsAddressDescription")
                    : t("settings.domains.legacyCustomDescription")}
                </p>
              </div>
              <Badge variant={domain.isPrimary ? "secondary" : "outline"}>
                {domain.isPrimary
                  ? t("settings.domains.primary")
                  : t("settings.domains.notPrimary")}
              </Badge>
            </CardHeader>
            <CardContent>
              <a
                className="inline-flex items-center gap-1.5 text-sm font-medium underline-offset-4 hover:underline"
                href={`//${domain.hostname}`}
                rel="noreferrer"
                target="_blank"
              >
                {t("settings.domains.openAddress")}
                <AppIcons.externalLink className="size-3.5" aria-hidden />
              </a>
            </CardContent>
          </Card>
        ))}
      </div>
    </SettingsSectionBody>
  );
}
