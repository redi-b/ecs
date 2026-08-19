"use client";

import type {
  MerchantDashboardAccess,
  StorefrontTemplateCatalogItem,
} from "@ecs/contracts";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AppIcons } from "@/components/app/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  getSelectedTemplateName,
  getStorefrontPublicationState,
  hasSavedStorefrontDraft,
} from "@/features/settings/settings-helpers";
import {
  SectionIntro,
  SettingsPanel,
  SettingsSectionBody,
  ShopLiveStatusBadge,
  StorefrontTemplateOption,
} from "@/features/settings/settings-sections";
import { useI18n } from "@/i18n/provider";
import { dashboardRoutes } from "@/lib/routes";
import { cn } from "@/lib/utils";

export function StorefrontSection({
  storefrontTemplates,
  summary,
}: {
  storefrontTemplates: StorefrontTemplateCatalogItem[];
  summary: MerchantDashboardAccess;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const notSelected = t("settings.storefront.notSelected");
  const [selectedKey, setSelectedKey] = useState(summary.storefront.templateKey);
  const [isPublished, setIsPublished] = useState(summary.storefront.isPublished);
  const [publishedTemplateKey, setPublishedTemplateKey] = useState(
    summary.storefront.publishedTemplateKey,
  );
  const [hasUnpublishedChanges, setHasUnpublishedChanges] = useState(
    summary.storefront.hasUnpublishedChanges ?? false,
  );
  const [pausing, setPausing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const activeKey = selectedKey ?? summary.storefront.templateKey;
  const publicationState = getStorefrontPublicationState({
    draftTemplateKey: activeKey,
    hasUnpublishedChanges,
    isPublished,
    publishedTemplateKey,
  });
  const hasPendingTemplateChange = publicationState.hasPendingChanges;
  const singleTemplate = storefrontTemplates.length === 1;
  const busy = pausing || publishing;

  useEffect(() => {
    setSelectedKey(summary.storefront.templateKey);
    setIsPublished(summary.storefront.isPublished);
    setPublishedTemplateKey(summary.storefront.publishedTemplateKey);
    setHasUnpublishedChanges(summary.storefront.hasUnpublishedChanges ?? false);
  }, [
    summary.storefront.hasUnpublishedChanges,
    summary.storefront.isPublished,
    summary.storefront.publishedTemplateKey,
    summary.storefront.templateKey,
  ]);

  async function pauseShop() {
    if (busy || !isPublished) return;
    setPausing(true);
    try {
      const response = await fetch(dashboardRoutes.storefrontUnpublish, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify({ tenantId: summary.tenant.id }),
      });
      const data = (await response.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
      } | null;

      if (!response.ok || !data?.ok) {
        toast.error(data?.message?.replaceAll("_", " ") || t("settings.storefront.pauseShopFailed"));
        return;
      }

      setIsPublished(false);
      toast.success(t("settings.storefront.pauseShopSuccess"));
      router.refresh();
    } catch {
      toast.error(t("settings.storefront.pauseShopFailed"));
    } finally {
      setPausing(false);
    }
  }

  async function publishShop() {
    if (busy || (isPublished && !hasPendingTemplateChange)) return;
    setPublishing(true);
    try {
      const response = await fetch(dashboardRoutes.storefrontPublish, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify({ tenantId: summary.tenant.id }),
      });
      const data = (await response.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
      } | null;

      if (!response.ok || !data?.ok) {
        toast.error(
          data?.message?.replaceAll("_", " ") || t("settings.storefront.publishShopFailed"),
        );
        return;
      }

      setIsPublished(true);
      setPublishedTemplateKey(activeKey);
      setHasUnpublishedChanges(false);
      toast.success(t("settings.storefront.publishShopSuccess"));
      router.refresh();
    } catch {
      toast.error(t("settings.storefront.publishShopFailed"));
    } finally {
      setPublishing(false);
    }
  }

  const designName =
    storefrontTemplates.find((item) => item.version.templateKey === activeKey)?.name ??
    getSelectedTemplateName(storefrontTemplates, summary, notSelected);
  const selectedVersion = storefrontTemplates.find(
    (item) => item.version.templateKey === activeKey,
  )?.version.version;
  const versionLabel = selectedVersion ?? summary.storefront.templateVersion
    ? `v${selectedVersion ?? summary.storefront.templateVersion}`
    : notSelected;

  return (
    <SettingsSectionBody>
      <SectionIntro
        description={t("settings.storefront.intro")}
        title={t("settings.sections.storefront.label")}
      />

      <Card
        className={cn(
          "overflow-hidden ring-1",
          isPublished
            ? "bg-emerald-500/[0.04] ring-emerald-500/25"
            : "bg-amber-500/[0.04] ring-amber-500/25",
        )}
        size="sm"
      >
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <ShopLiveStatusBadge live={isPublished} />
              <span className="text-sm font-semibold tracking-tight">
                {isPublished
                  ? t("settings.storefront.liveTitle")
                  : t("settings.storefront.pausedTitle")}
              </span>
              {publicationState.mode === "live-current" ? (
                <Badge variant="outline">{t("settings.storefront.upToDate")}</Badge>
              ) : null}
              {publicationState.mode === "live-with-draft" ? (
                <Badge variant="secondary">{t("settings.storefront.unpublishedChanges")}</Badge>
              ) : null}
            </div>
            <p className="max-w-xl text-sm text-muted-foreground">
              {isPublished
                ? hasPendingTemplateChange
                  ? publicationState.draftUsesDifferentTemplate
                    ? t("settings.storefront.liveDescriptionWithDraft")
                    : t("settings.storefront.liveDescriptionWithChanges")
                  : t("settings.storefront.liveDescription")
                : t("settings.storefront.pausedDescription")}
            </p>
            <a
              className="inline-flex max-w-full items-center gap-1.5 text-sm font-medium text-foreground underline-offset-4 hover:underline"
              href={`//${summary.domain.hostname}`}
              rel="noreferrer"
              target="_blank"
            >
              <span className="truncate">{summary.domain.hostname}</span>
              <AppIcons.externalLink className="size-3.5 shrink-0 opacity-60" aria-hidden />
            </a>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>
                {t(
                  hasPendingTemplateChange
                    ? "settings.storefront.draftDesign"
                    : "settings.storefront.selectedDesign",
                )}:{" "}
                <span className="font-medium text-foreground">{designName}</span>
              </span>
              <span>
                {t("settings.storefront.version")}:{" "}
                <span className="font-medium text-foreground">{versionLabel}</span>
              </span>
            </div>
          </div>

          <div className="flex shrink-0 flex-col gap-2 sm:min-w-[11.5rem]">
            {publicationState.canPublish ? (
              <Button
                className="w-full rounded-full"
                disabled={busy}
                onClick={() => void publishShop()}
                size="sm"
                type="button"
              >
                {publishing
                  ? t("settings.storefront.publishShopPending")
                  : !isPublished
                    ? t("settings.storefront.publishShop")
                    : publicationState.draftUsesDifferentTemplate
                      ? t("settings.storefront.publishSelectedDesign", { name: designName })
                      : t("settings.storefront.publishChanges")}
              </Button>
            ) : null}
            {publicationState.canPause ? (
              <ConfirmDialog
                cancelDisabled={pausing}
                confirmDisabled={pausing || busy}
                confirmLabel={t("settings.storefront.pauseShopConfirm")}
                description={t("settings.storefront.pauseShopDescription")}
                eyebrow={t("common.confirm.dangerEyebrow")}
                icon="warning"
                onConfirm={() => void pauseShop()}
                title={t("settings.storefront.pauseShopTitle")}
                trigger={
                  <Button
                    className="w-full rounded-full"
                    disabled={busy}
                    size="sm"
                    type="button"
                    variant="destructive"
                  >
                    {pausing
                      ? t("settings.storefront.pauseShopPending")
                      : t("settings.storefront.pauseShop")}
                  </Button>
                }
              />
            ) : null}
            <Button asChild className="w-full rounded-full" size="sm" variant="outline">
              <a href={dashboardRoutes.editor}>{t("settings.storefront.editStorefront")}</a>
            </Button>
            <Button asChild className="w-full rounded-full" size="sm" variant="ghost">
              <a href={`//${summary.domain.hostname}`} rel="noreferrer" target="_blank">
                {t("settings.storefront.viewShop")}
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      <SettingsPanel
        description={
          singleTemplate
            ? t("settings.storefront.designDescriptionSingle")
            : t("settings.storefront.designDescription")
        }
        title={t("settings.storefront.designTitle")}
        contentClassName="flex flex-col gap-3"
      >
        {storefrontTemplates.length ? (
          <div className={cn("grid gap-3", singleTemplate ? "max-w-lg" : "sm:grid-cols-2")}>
            {storefrontTemplates.map((template) => (
              <StorefrontTemplateOption
                currentTemplateKey={activeKey}
                hasSavedDraft={hasSavedStorefrontDraft(
                  summary.storefront.savedTemplateKeys,
                  template.version.templateKey,
                )}
                key={template.version.templateKey}
                {...(publishedTemplateKey !== undefined ? { publishedTemplateKey } : {})}
                onSelected={(templateKey, nextHasUnpublishedChanges) => {
                  setSelectedKey(templateKey);
                  setHasUnpublishedChanges(nextHasUnpublishedChanges);
                }}
                template={template}
                tenantId={summary.tenant.id}
              />
            ))}
          </div>
        ) : (
          <Alert>
            <AlertTitle>{t("settings.storefront.noneTitle")}</AlertTitle>
            <AlertDescription>{t("settings.storefront.noneDescription")}</AlertDescription>
          </Alert>
        )}
      </SettingsPanel>
    </SettingsSectionBody>
  );
}
