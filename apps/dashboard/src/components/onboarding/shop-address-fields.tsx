"use client";

import type { ShopDetails } from "@ecs/contracts";
import { useId, useState } from "react";
import { AppIcons } from "@/components/app/icons";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/i18n/provider";

type Address = NonNullable<ShopDetails["address"]>;

/** Manual entry is the primary flow, even when optional maps are configured. */
export function ShopAddressFields({
  value,
  onChange,
  disabled = false,
}: {
  value: ShopDetails["address"];
  onChange: (address: Address) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const { t } = useI18n();
  const extraFields = ["region", "subcity", "woreda", "area"] as const;
  const hasExtraDetails = extraFields.some((field) => value?.[field]?.trim());
  const [detailsOpen, setDetailsOpen] = useState(hasExtraDetails);
  function update(field: keyof Address, text: string) {
    onChange({ city: "", streetAddress: "", directions: "", ...value, [field]: text });
  }

  return (
    <FieldSet>
      <FieldLegend variant="label">{t("onboarding.contact.address")}</FieldLegend>
      <FieldDescription>{t("onboarding.contact.addressHelp")}</FieldDescription>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={`${id}-street`}>{t("onboarding.contact.streetAddress")}</FieldLabel>
          <Textarea
            className="min-h-20 resize-y"
            id={`${id}-street`}
            disabled={disabled}
            maxLength={500}
            autoComplete="street-address"
            value={value?.streetAddress ?? ""}
            onChange={(event) => update("streetAddress", event.target.value)}
          />
        </Field>
        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor={`${id}-city`}>{t("onboarding.contact.city")}</FieldLabel>
            <Input
              id={`${id}-city`}
              disabled={disabled}
              maxLength={100}
              autoComplete="address-level2"
              value={value?.city ?? ""}
              onChange={(event) => update("city", event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-landmark`}>{t("onboarding.contact.landmark")}</FieldLabel>
            <Input
              id={`${id}-landmark`}
              disabled={disabled}
              maxLength={300}
              value={value?.landmark ?? ""}
              onChange={(event) => update("landmark", event.target.value)}
            />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor={`${id}-directions`}>{t("onboarding.contact.directions")}</FieldLabel>
          <Textarea
            className="min-h-20 resize-y"
            id={`${id}-directions`}
            disabled={disabled}
            maxLength={300}
            value={value?.directions ?? ""}
            onChange={(event) => update("directions", event.target.value)}
          />
        </Field>
        <Collapsible className="group" open={detailsOpen} onOpenChange={setDetailsOpen}>
          <CollapsibleTrigger
            type="button"
            className="flex min-h-10 cursor-pointer items-center gap-2 text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <AppIcons.arrowDown
              className="size-4 transition-transform duration-200 ease-[var(--ease-dashboard)] group-data-[state=open]:rotate-180 motion-reduce:transition-none"
              aria-hidden
            />
            {t("onboarding.contact.moreAddressDetails")}
          </CollapsibleTrigger>
          <CollapsibleContent className="motion-reduce:animate-none">
            <div className="grid min-w-0 gap-4 pt-3 sm:grid-cols-2">
              {extraFields.map((field) => (
                <Field key={field}>
                  <FieldLabel htmlFor={`${id}-${field}`}>
                    {t(`onboarding.contact.${field}`)}
                  </FieldLabel>
                  <Input
                    id={`${id}-${field}`}
                    disabled={disabled}
                    maxLength={100}
                    autoComplete={field === "region" ? "address-level1" : "off"}
                    value={value?.[field] ?? ""}
                    onChange={(event) => update(field, event.target.value)}
                  />
                </Field>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </FieldGroup>
    </FieldSet>
  );
}
