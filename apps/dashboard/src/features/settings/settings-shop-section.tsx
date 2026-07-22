"use client";

import type { MerchantDashboardAccess } from "@ecs/contracts";

import { AppIcons } from "@/components/app/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { HandleAvailability } from "@/features/settings/settings-helpers";
import {
  SectionIntro,
  SettingsLinkRow,
  SettingsRow,
} from "@/features/settings/settings-sections";
import { useI18n } from "@/i18n/provider";
import { dashboardRoutes } from "@/lib/routes";

export function ShopSection({
  canSaveShop,
  currentHost,
  handle,
  handleAvailability,
  handleChanged,
  handleId,
  handleUnlocked,
  isPending,
  name,
  nameChanged,
  nameId,
  nextHost,
  onHandleChange,
  onNameChange,
  onSave,
  onToggleHandleLock,
  summary,
}: {
  canSaveShop: boolean;
  currentHost: string;
  handle: string;
  handleAvailability: HandleAvailability;
  handleChanged: boolean;
  handleId: string;
  handleUnlocked: boolean;
  isPending: boolean;
  name: string;
  nameChanged: boolean;
  nameId: string;
  nextHost: string;
  onHandleChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onSave: () => void;
  onToggleHandleLock: () => void;
  summary: MerchantDashboardAccess;
}) {
  const { t } = useI18n();
  const dirty = nameChanged || handleChanged;

  return (
    <div className="flex flex-col gap-6">
      <SectionIntro
        description={t("settings.shop.intro")}
        title={t("settings.sections.shop.label")}
      />
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_17.5rem]">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">{t("settings.shop.detailsTitle")}</CardTitle>
            <CardDescription>{t("settings.shop.detailsDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor={nameId}>{t("settings.shop.name")}</FieldLabel>
                <Input id={nameId} onChange={(e) => onNameChange(e.target.value)} value={name} />
              </Field>
              <Field>
                <div className="flex items-center justify-between gap-2">
                  <FieldLabel htmlFor={handleId}>{t("settings.shop.handle")}</FieldLabel>
                  {!handleUnlocked ? (
                    <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                      {t("settings.handle.locked")}
                    </span>
                  ) : null}
                </div>
                <InputGroup>
                  <InputGroupInput
                    aria-invalid={
                      handleAvailability.status === "unavailable" ||
                      handleAvailability.status === "invalid"
                        ? true
                        : undefined
                    }
                    disabled={!handleUnlocked}
                    id={handleId}
                    onChange={(e) => onHandleChange(e.target.value)}
                    spellCheck={false}
                    value={handle}
                  />
                  <InputGroupAddon align="inline-end">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <InputGroupButton
                          aria-label={
                            handleUnlocked
                              ? t("settings.handle.lockAria")
                              : t("settings.handle.unlockAria")
                          }
                          onClick={onToggleHandleLock}
                          size="icon-xs"
                          type="button"
                        >
                          {handleUnlocked ? <AppIcons.lockUnlock /> : <AppIcons.lock />}
                        </InputGroupButton>
                      </TooltipTrigger>
                      <TooltipContent>
                        {handleUnlocked
                          ? t("settings.handle.lockTooltip")
                          : t("settings.handle.unlockTooltip")}
                      </TooltipContent>
                    </Tooltip>
                  </InputGroupAddon>
                </InputGroup>
                <FieldDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-mono text-xs">{nextHost}</span>
                  <HandleStatus availability={handleAvailability} />
                </FieldDescription>
              </Field>
            </FieldGroup>
            {handleChanged ? (
              <Alert>
                <AlertTitle>{t("settings.shop.addressChangeTitle")}</AlertTitle>
                <AlertDescription>{t("settings.shop.addressChangeDescription")}</AlertDescription>
              </Alert>
            ) : null}
            <div className="flex justify-end">
              <Button
                className="rounded-full"
                disabled={!canSaveShop || !dirty || isPending}
                onClick={onSave}
                size="sm"
                type="button"
              >
                {isPending ? t("common.saving") : t("settings.shop.saveShop")}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t("settings.shop.hostname")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <SettingsLinkRow
                label={handleChanged ? t("settings.shop.current") : t("settings.shop.primary")}
                value={currentHost}
              />
              {handleChanged ? (
                <SettingsLinkRow label={t("settings.shop.afterSave")} value={nextHost} />
              ) : null}
              <SettingsRow label={t("settings.shop.status")} value={summary.tenant.status} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t("settings.shop.related")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Button asChild className="justify-start rounded-full" size="sm" variant="outline">
                <a href={dashboardRoutes.billing}>{t("settings.shop.billingPlan")}</a>
              </Button>
              <Button asChild className="justify-start rounded-full" size="sm" variant="outline">
                <a href={dashboardRoutes.editor}>{t("settings.shop.storefrontEditor")}</a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function HandleStatus({ availability }: { availability: HandleAvailability }) {
  const { t } = useI18n();
  if (availability.status === "checking") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <AppIcons.loader className="size-3 animate-spin" />
        {t("settings.handle.checking")}
      </span>
    );
  }
  if (availability.status === "available") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
        <AppIcons.check className="size-3" />
        {t("settings.handle.available")}
      </span>
    );
  }
  if (availability.status === "unavailable" || availability.status === "invalid") {
    return (
      <span className="text-xs font-medium text-destructive">{availability.message}</span>
    );
  }
  if (availability.status === "current") {
    return <span className="text-xs text-muted-foreground">{t("settings.handle.current")}</span>;
  }
  return null;
}
