"use client";

import type { MerchantProductCategory } from "@ecs/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { toast } from "sonner";

import { AppIcons } from "@/components/app/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  getCategoryDisplayName,
  slugifyTaxonomyHandle,
} from "@/features/catalog-taxonomy/taxonomy-table-state";
import { useI18n } from "@/i18n/provider";
import { useCreateQueryOpen } from "@/lib/use-create-query-open";

type TaxonomyCreateDialogProps = {
  action: string;
  entityLabel: "category" | "collection";
  nameKey: "name" | "title";
  nameLabel: string;
  namePlaceholder: string;
  /** Existing categories for parent selection (category create only). */
  parentOptions?: MerchantProductCategory[];
  queryKey: string;
  triggerLabel: string;
};

export function TaxonomyCreateDialog(props: TaxonomyCreateDialogProps) {
  return (
    <Suspense
      fallback={
        <Button type="button" disabled>
          {props.triggerLabel}
        </Button>
      }
    >
      <TaxonomyCreateDialogInner {...props} />
    </Suspense>
  );
}

function TaxonomyCreateDialogInner({
  action,
  entityLabel,
  nameKey,
  nameLabel,
  namePlaceholder,
  parentOptions = [],
  queryKey,
  triggerLabel,
}: TaxonomyCreateDialogProps) {
  const { t } = useI18n();
  const localizedEntity = t(`taxonomy.entity.${entityLabel}` as any);
  const localizedEntityPlural = t(`taxonomy.entity.${entityLabel}.plural` as any);

  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [isHandleLocked, setIsHandleLocked] = useState(true);
  const [parentCategoryId, setParentCategoryId] = useState<string>("__root__");
  const [isVisible, setIsVisible] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useCreateQueryOpen({
    values: ["1", "true", entityLabel],
    onOpen: () => {
      setOpen(true);
    },
  });
  const generatedHandle = useMemo(() => slugifyTaxonomyHandle(displayName), [displayName]);
  const HandleLockIcon = isHandleLocked ? AppIcons.lock : AppIcons.lockUnlock;

  const sortedParents = useMemo(
    () =>
      [...parentOptions].sort((a, b) =>
        getCategoryDisplayName(a).localeCompare(getCategoryDisplayName(b)),
      ),
    [parentOptions],
  );

  function resetForm() {
    setDisplayName("");
    setHandle("");
    setIsHandleLocked(true);
    setParentCategoryId("__root__");
    setIsVisible(true);
    setError(null);
  }

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

  async function submitTaxonomy() {
    const trimmedName = displayName.trim();

    if (!trimmedName) {
      setError(
        t("taxonomy.create.error.enterName" as any, {
          entity: localizedEntity,
          field: nameLabel.toLowerCase(),
        }),
      );
      return;
    }

    setIsSaving(true);
    setError(null);

    const payload: Record<string, string | null> = {
      [nameKey]: trimmedName,
      handle: handle.trim() || null,
    };

    if (entityLabel === "category") {
      payload.parentCategoryId =
        parentCategoryId && parentCategoryId !== "__root__" ? parentCategoryId : null;
      payload.visibility = isVisible ? "public" : "hidden";
    }

    if (entityLabel === "collection") {
      payload.visibility = isVisible ? "public" : "hidden";
    }

    const response = await fetch(action, {
      body: JSON.stringify(payload),
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      method: "POST",
    }).catch(() => null);
    const data = (await response?.json().catch(() => ({}))) as { error?: string };

    setIsSaving(false);

    if (!response?.ok) {
      setError(getTaxonomyCreateErrorMessage(entityLabel, data.error, t));
      return;
    }

    toast.success(t("taxonomy.create.success" as any, { entity: capitalize(localizedEntity) }));
    setOpen(false);
    resetForm();
    await queryClient.invalidateQueries({ queryKey: [queryKey] });
    router.refresh();
  }

  return (
    <Dialog
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) resetForm();
      }}
      open={open}
    >
      <DialogTrigger asChild>
        <Button type="button">
          {entityLabel === "category" ? (
            <AppIcons.tree data-icon="inline-start" />
          ) : (
            <AppIcons.folder data-icon="inline-start" />
          )}
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="gap-1.5 border-b px-4 py-4 text-left sm:px-5">
          <DialogTitle>
            {t("taxonomy.create.title" as any, { entity: localizedEntity })}
          </DialogTitle>
          <DialogDescription>
            {entityLabel === "category"
              ? t("taxonomy.create.category.desc" as any)
              : t("taxonomy.create.collection.desc" as any)}
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            void submitTaxonomy();
          }}
        >
          <div className="grid gap-4 p-4 sm:p-5">
            {error ? (
              <Alert variant="destructive">
                <AlertTitle>
                  {t("taxonomy.create.error.createFailed" as any, {
                    entity: capitalize(localizedEntity),
                  })}
                </AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <Field>
              <FieldLabel htmlFor={`taxonomy-${entityLabel}-name`}>{nameLabel}</FieldLabel>
              <Input
                autoComplete="off"
                id={`taxonomy-${entityLabel}-name`}
                onChange={(event) => updateDisplayName(event.target.value)}
                placeholder={namePlaceholder}
                required
                value={displayName}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor={`taxonomy-${entityLabel}-handle`}>
                {t("taxonomy.create.handle" as any)}
              </FieldLabel>
              <InputGroup className="pr-1">
                <InputGroupInput
                  id={`taxonomy-${entityLabel}-handle`}
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
                            ? t("taxonomy.create.unlockHandle" as any)
                            : t("taxonomy.create.lockHandle" as any)
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
                        ? t("taxonomy.create.unlockHandle" as any)
                        : t("taxonomy.create.lockHandle" as any)}
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        aria-label={t("taxonomy.create.regenerateHandle" as any, {
                          entity: localizedEntity,
                        })}
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
                      {t("taxonomy.create.regenerateFrom" as any, {
                        field: nameLabel.toLowerCase(),
                      })}
                    </TooltipContent>
                  </Tooltip>
                </InputGroupAddon>
              </InputGroup>
              <FieldDescription>
                {isHandleLocked
                  ? t("taxonomy.create.handleFollows" as any, {
                      entity: localizedEntity,
                      field: nameLabel.toLowerCase(),
                    })
                  : t("taxonomy.create.handleCustom" as any, { entity: localizedEntity })}
              </FieldDescription>
            </Field>

            {entityLabel === "category" ? (
              <Field>
                <FieldLabel>{t("taxonomy.create.parentCategory" as any)}</FieldLabel>
                <Select onValueChange={setParentCategoryId} value={parentCategoryId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t("taxonomy.create.rootCategory" as any)} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="__root__">
                        {t("taxonomy.create.rootCategory" as any)}
                      </SelectItem>
                      {sortedParents.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {getCategoryDisplayName(category)}
                          {category.handle ? (
                            <span className="ml-2 text-muted-foreground">/{category.handle}</span>
                          ) : null}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FieldDescription>{t("taxonomy.create.parentDesc" as any)}</FieldDescription>
              </Field>
            ) : null}

            <Field className="flex flex-row items-center justify-between gap-4 rounded-xl border px-3.5 py-3">
              <div className="min-w-0 space-y-1">
                <FieldLabel className="text-sm" htmlFor={`taxonomy-${entityLabel}-visible`}>
                  {t("taxonomy.create.visibleLabel" as any)}
                </FieldLabel>
                <FieldDescription className="text-xs">
                  {t("taxonomy.create.visibleDesc" as any, {
                    entityPlural: localizedEntityPlural,
                  })}
                </FieldDescription>
              </div>
              <Switch
                checked={isVisible}
                id={`taxonomy-${entityLabel}-visible`}
                onCheckedChange={setIsVisible}
              />
            </Field>
          </div>
          <DialogFooter className="mx-0 mb-0 rounded-none border-t bg-muted/50 p-4 sm:justify-end">
            <Button
              disabled={isSaving}
              onClick={() => setOpen(false)}
              type="button"
              variant="outline"
            >
              {t("common.cancel" as any)}
            </Button>
            <Button disabled={isSaving} type="submit">
              {isSaving
                ? t("taxonomy.create.creating" as any)
                : t("taxonomy.create.createBtn" as any, { entity: localizedEntity })}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function getTaxonomyCreateErrorMessage(
  entityLabel: "category" | "collection",
  error: string | undefined,
  t: (key: any, params?: any) => string,
) {
  const localizedEntity = t(`taxonomy.entity.${entityLabel}`);

  if (error === "missing_name" || error === "missing_title") {
    return t("taxonomy.create.error.missing", { entity: localizedEntity });
  }

  if (error === "commerce_backend_unavailable") {
    return t("taxonomy.create.error.backend");
  }

  if (error === "commerce_credentials_missing" || error === "commerce_credentials_invalid") {
    return t("taxonomy.create.error.credentials");
  }

  return t("taxonomy.create.error.genericSave", { entity: capitalize(localizedEntity) });
}

function capitalize(value: string) {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}
