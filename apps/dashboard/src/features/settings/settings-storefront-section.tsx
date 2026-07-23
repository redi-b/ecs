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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getSelectedTemplateName } from "@/features/settings/settings-helpers";
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
  const [pausing, setPausing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const activeKey = selectedKey ?? summary.storefront.templateKey;
  const singleTemplate = storefrontTemplates.length === 1;
  const busy = pausing || publishing;

  useEffect(() => {
    setIsPublished(summary.storefront.isPublished);
  }, [summary.storefront.isPublished]);

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
    if (busy || isPublished) return;
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
  const versionLabel = summary.storefront.templateVersion
    ? `v${summary.storefront.templateVersion}`
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
            </div>
            <p className="max-w-xl text-sm text-muted-foreground">
              {isPublished
                ? t("settings.storefront.liveDescription")
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
                {t("settings.storefront.selectedDesign")}:{" "}
                <span className="font-medium text-foreground">{designName}</span>
              </span>
              <span>
                {t("settings.storefront.version")}:{" "}
                <span className="font-medium text-foreground">{versionLabel}</span>
              </span>
            </div>
          </div>

          <div className="flex shrink-0 flex-col gap-2 sm:min-w-[11.5rem]">
            {isPublished ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
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
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("settings.storefront.pauseShopTitle")}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t("settings.storefront.pauseShopDescription")}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-full" disabled={pausing}>
                      {t("common.cancel")}
                    </AlertDialogCancel>
                    <AlertDialogAction
                      className="rounded-full"
                      disabled={pausing}
                      onClick={(event) => {
                        event.preventDefault();
                        void pauseShop();
                      }}
                      variant="destructive"
                    >
                      {t("settings.storefront.pauseShopConfirm")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <Button
                className="w-full rounded-full"
                disabled={busy}
                onClick={() => void publishShop()}
                size="sm"
                type="button"
              >
                {publishing
                  ? t("settings.storefront.publishShopPending")
                  : t("settings.storefront.publishShop")}
              </Button>
            )}
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
                key={template.version.templateKey}
                onSelected={setSelectedKey}
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
