"use client";

import { useId, useMemo, useState } from "react";
 
import { AppIcons } from "@/components/app/icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { slugifyTaxonomyHandle } from "@/features/catalog-taxonomy/taxonomy-table-state";
import { useI18n } from "@/i18n/provider";

type TaxonomyFormProps = {
  action: string;
  entityLabel: "category" | "collection";
  name: string;
  nameLabel: string;
  namePlaceholder: string;
  submitLabel: string;
};

export function TaxonomyForm({
  action,
  entityLabel,
  name,
  nameLabel,
  namePlaceholder,
  submitLabel,
}: TaxonomyFormProps) {
  const { t } = useI18n();
  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [isHandleLocked, setIsHandleLocked] = useState(true);
  const formId = useId();
  const generatedHandle = useMemo(() => slugifyTaxonomyHandle(displayName), [displayName]);
  const HandleLockIcon = isHandleLocked ? AppIcons.lock : AppIcons.lockUnlock;

  const localizedEntity = t(`taxonomy.entity.${entityLabel}` as any);

  function updateDisplayName(nextName: string) {
    setDisplayName(nextName);

    if (isHandleLocked) {
      setHandle(slugifyTaxonomyHandle(nextName));
    }
  }

  function regenerateHandle() {
    setHandle(generatedHandle);
    setIsHandleLocked(true);
  }

  return (
    <form action={action} className="max-w-2xl" method="post">
      <Card>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={`${formId}-name`}>{nameLabel}</FieldLabel>
              <Input
                autoComplete="off"
                id={`${formId}-name`}
                name={name}
                onChange={(event) => updateDisplayName(event.target.value)}
                placeholder={namePlaceholder}
                required
                value={displayName}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor={`${formId}-handle`}>{t("common.handle" as any)}</FieldLabel>
              <InputGroup className="pr-1">
                <InputGroupInput
                  id={`${formId}-handle`}
                  name="handle"
                  onChange={(event) => setHandle(slugifyTaxonomyHandle(event.target.value))}
                  placeholder={slugifyTaxonomyHandle(namePlaceholder)}
                  readOnly={isHandleLocked}
                  value={handle}
                />
                <InputGroupAddon align="inline-end" className="gap-1 py-0 pr-0">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        aria-label={
                          isHandleLocked
                            ? t("taxonomy.form.lockHandle" as any)
                            : t("taxonomy.form.unlockHandle" as any)
                        }
                        className="rounded-full"
                        onClick={() => setIsHandleLocked((current) => !current)}
                        size="icon-sm"
                        type="button"
                        variant="ghost"
                      >
                        <HandleLockIcon data-icon="inline-start" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={6}>
                      {isHandleLocked
                        ? t("taxonomy.form.unlockHandle" as any)
                        : t("taxonomy.form.lockHandle" as any)}
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        aria-label={t("taxonomy.form.regenerateHandle" as any, { entity: localizedEntity })}
                        className="rounded-full"
                        onClick={regenerateHandle}
                        size="icon-sm"
                        type="button"
                        variant="ghost"
                      >
                        <AppIcons.refresh data-icon="inline-start" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={6}>
                      {t("taxonomy.form.regenerateFrom" as any, { label: nameLabel.toLowerCase() })}
                    </TooltipContent>
                  </Tooltip>
                </InputGroupAddon>
              </InputGroup>
              <FieldDescription>
                {isHandleLocked
                  ? t("taxonomy.form.handleFollows" as any, { entity: localizedEntity, label: nameLabel.toLowerCase() })
                  : t("taxonomy.form.handleUnlocked" as any, { entity: localizedEntity })}
              </FieldDescription>
            </Field>

            <div className="flex justify-end">
              <Button type="submit">{submitLabel}</Button>
            </div>
          </FieldGroup>
        </CardContent>
      </Card>
    </form>
  );
}
