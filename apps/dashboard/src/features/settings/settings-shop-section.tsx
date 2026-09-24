"use client";

import { usePolicy } from "@/components/app/access-context";
import { AppIcons } from "@/components/app/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
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
  SettingsPanel,
  SettingsSectionBody,
} from "@/features/settings/settings-sections";
import { useI18n } from "@/i18n/provider";
import { merchantPolicies } from "@/lib/access-policy";

export function ShopSection({
  contactFields,
  detailsDirty = false,
  canSaveShop,
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
}: {
  contactFields?: import("react").ReactNode;
  detailsDirty?: boolean;
  canSaveShop: boolean;
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
}) {
  const { t } = useI18n();
  const canManage = usePolicy(merchantPolicies.shopSettingsManage);
  const dirty = nameChanged || handleChanged || detailsDirty;

  return (
    <SettingsSectionBody>
      <SectionIntro title={t("settings.sections.shop.label")} />
      <div className="w-full max-w-5xl">
        <SettingsPanel
          description={t("settings.shop.detailsDescription")}
          title={t("settings.shop.detailsTitle")}
          contentClassName="flex flex-col gap-6"
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={nameId}>{t("settings.shop.name")}</FieldLabel>
              <Input
                disabled={!canManage}
                id={nameId}
                onChange={(e) => onNameChange(e.target.value)}
                value={name}
              />
            </Field>
            <Field>
              <div className="flex items-center justify-between gap-2">
                <FieldLabel htmlFor={handleId}>{t("settings.shop.handle")}</FieldLabel>
                {!handleUnlocked ? (
                  <span className="text-xs font-medium text-muted-foreground">
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
                {canManage ? (
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
                ) : null}
              </InputGroup>
              <FieldDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-mono text-xs">{nextHost}</span>
                <HandleStatus availability={handleAvailability} />
              </FieldDescription>
            </Field>
          </FieldGroup>
          <div className="border-t pt-6">{contactFields}</div>
          {handleChanged ? (
            <Alert>
              <AlertTitle>{t("settings.shop.addressChangeTitle")}</AlertTitle>
              <AlertDescription>{t("settings.shop.addressChangeDescription")}</AlertDescription>
            </Alert>
          ) : null}
          {canManage ? (
            <div className="flex justify-end">
              <Button
                className="w-full rounded-full sm:w-auto"
                disabled={!canSaveShop || !dirty || isPending}
                onClick={onSave}
                size="sm"
                type="button"
              >
                {isPending ? t("common.saving") : t("settings.shop.saveShop")}
              </Button>
            </div>
          ) : null}
        </SettingsPanel>
      </div>
    </SettingsSectionBody>
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
    return <span className="text-xs font-medium text-destructive">{availability.message}</span>;
  }
  if (availability.status === "current") {
    return <span className="text-xs text-muted-foreground">{t("settings.handle.current")}</span>;
  }
  return null;
}
