"use client";

import { AppIcons } from "@/components/app/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { Switch } from "@/components/ui/switch";
import {
  SectionIntro,
  SettingsPanel,
  SettingsSectionBody,
} from "@/features/settings/settings-sections";
import type { Delivery } from "@/features/settings/settings-types";
import { deliveryFieldKeys } from "@/features/settings/settings-types";
import { useI18n } from "@/i18n/provider";

export function FulfillmentSection({
  currencyId,
  deliveryFeeId,
  deliveryState,
  isPending,
  onDeliveryChange,
  onSaveDelivery,
  onSaveFee,
  savingFee,
}: {
  currencyId: string;
  deliveryFeeId: string;
  deliveryState: Delivery | null;
  isPending: boolean;
  onDeliveryChange: (value: Delivery) => void;
  onSaveDelivery: (value: Delivery, label?: string) => void;
  onSaveFee: () => void;
  savingFee: boolean;
}) {
  const { t } = useI18n();
  return (
    <SettingsSectionBody>
      <SectionIntro
        description={t("settings.fulfillment.intro")}
        title={t("settings.sections.fulfillment.label")}
      />
      <SettingsPanel
        description={t("settings.fulfillment.checkoutDescription")}
        title={t("settings.fulfillment.checkoutTitle")}
        contentClassName="flex flex-col gap-4"
      >
        {deliveryState ? (
          <>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {deliveryFieldKeys.map((item) => {
                const isMethodToggle =
                  item.key === "deliveryEnabled" || item.key === "pickupEnabled";
                // Keep at least one of delivery / pickup available for checkout.
                const wouldDisableLastMethod =
                  isMethodToggle &&
                  deliveryState[item.key] &&
                  !(item.key === "deliveryEnabled"
                    ? deliveryState.pickupEnabled
                    : deliveryState.deliveryEnabled);

                return (
                  <Field
                    className="rounded-lg border border-border/70 bg-muted/10 p-3"
                    key={item.key}
                    orientation="horizontal"
                  >
                    <FieldContent>
                      <FieldTitle>{t(item.labelKey)}</FieldTitle>
                      <FieldDescription>
                        {wouldDisableLastMethod
                          ? t("settings.fulfillment.keepOneMethod")
                          : t(item.descriptionKey)}
                      </FieldDescription>
                    </FieldContent>
                    <Switch
                      checked={deliveryState[item.key]}
                      disabled={isPending || wouldDisableLastMethod}
                      onCheckedChange={(checked) => {
                        if (
                          isMethodToggle &&
                          !checked &&
                          !(item.key === "deliveryEnabled"
                            ? deliveryState.pickupEnabled
                            : deliveryState.deliveryEnabled)
                        ) {
                          return;
                        }
                        onSaveDelivery(
                          {
                            ...deliveryState,
                            [item.key]: checked,
                          },
                          t(item.labelKey),
                        );
                      }}
                    />
                  </Field>
                );
              })}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor={deliveryFeeId}>
                  {t("settings.fulfillment.defaultFee")}
                </FieldLabel>
                <InputGroup>
                  <InputGroupAddon align="inline-start">
                    <InputGroupText>ETB</InputGroupText>
                  </InputGroupAddon>
                  <InputGroupInput
                    disabled={savingFee}
                    id={deliveryFeeId}
                    min="0"
                    onChange={(event) =>
                      onDeliveryChange({
                        ...deliveryState,
                        defaultDeliveryFee: event.target.value,
                      })
                    }
                    step="0.01"
                    type="number"
                    value={deliveryState.defaultDeliveryFee}
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      aria-busy={savingFee}
                      className="rounded-full"
                      disabled={savingFee || isPending}
                      onClick={onSaveFee}
                      size="xs"
                      type="button"
                      variant="secondary"
                    >
                      {savingFee ? (
                        <>
                          <AppIcons.loader className="animate-spin" />
                          {t("common.saving")}
                        </>
                      ) : (
                        t("common.save")
                      )}
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
                <FieldDescription>{t("settings.fulfillment.feeHint")}</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor={currencyId}>{t("settings.fulfillment.currency")}</FieldLabel>
                <Input disabled id={currencyId} readOnly value="ETB" />
                <FieldDescription>{t("settings.fulfillment.currencyHint")}</FieldDescription>
              </Field>
            </div>
          </>
        ) : (
          <Alert>
            <AlertTitle>{t("settings.fulfillment.unavailableTitle")}</AlertTitle>
            <AlertDescription>
              {t("settings.fulfillment.unavailableDescription")}
            </AlertDescription>
          </Alert>
        )}
      </SettingsPanel>
    </SettingsSectionBody>
  );
}
