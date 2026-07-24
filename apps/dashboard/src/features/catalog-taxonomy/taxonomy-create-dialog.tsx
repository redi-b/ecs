"use client";

import type { MerchantProductCategory, MerchantProductCollection } from "@ecs/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { toast } from "sonner";

import { AppIcons } from "@/components/app/icons";
import { UnsavedChangesDialog } from "@/components/app/unsaved-changes-dialog";
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
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ParentCategoryCombobox } from "@/features/catalog-taxonomy/parent-category-combobox";
import {
  getCategoryDisplayName,
  slugifyTaxonomyHandle,
} from "@/features/catalog-taxonomy/taxonomy-table-state";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/provider";
import { useCreateQueryOpen } from "@/lib/use-create-query-open";

export type TaxonomyCreatedPayload = {
  category?: MerchantProductCategory;
  collection?: MerchantProductCollection;
  entityLabel: "category" | "collection";
};

type TaxonomyCreateDialogProps = {
  action: string;
  entityLabel: "category" | "collection";
  nameKey: "name" | "title";
  nameLabel: string;
  namePlaceholder: string;
  /** Called after a successful create with the new entity when available. */
  onCreated?: (payload: TaxonomyCreatedPayload) => void;
  onOpenChange?: (open: boolean) => void;
  /** Controlled open state (for embedding without page navigation). */
  open?: boolean;
  /** Existing categories for parent selection (category create only). */
  parentOptions?: MerchantProductCategory[];
  queryKey: string;
  /** When false, no trigger button is rendered (use controlled open). */
  showTrigger?: boolean;
  triggerLabel?: string;
};

export function TaxonomyCreateDialog(props: TaxonomyCreateDialogProps) {
  const showTrigger = props.showTrigger ?? true;
  return (
    <Suspense
      fallback={
        showTrigger ? (
          <Button type="button" disabled>
            {props.triggerLabel}
          </Button>
        ) : null
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
  onCreated,
  onOpenChange,
  open: openProp,
  parentOptions = [],
  queryKey,
  showTrigger = true,
  triggerLabel,
}: TaxonomyCreateDialogProps) {
  const { t } = useI18n();
  const localizedEntity = t(`taxonomy.entity.${entityLabel}.label` as MessageKey);
  const localizedEntityPlural = t(`taxonomy.entity.${entityLabel}.plural` as MessageKey);

  const router = useRouter();
  const queryClient = useQueryClient();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : uncontrolledOpen;
  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [isHandleLocked, setIsHandleLocked] = useState(true);
  const [parentCategoryId, setParentCategoryId] = useState<string>("__root__");
  const [isVisible, setIsVisible] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  function setOpen(nextOpen: boolean) {
    if (!isControlled) setUncontrolledOpen(nextOpen);
    onOpenChange?.(nextOpen);
  }

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

  const isDirty =
    open &&
    (displayName.trim().length > 0 ||
      handle.trim().length > 0 ||
      parentCategoryId !== "__root__" ||
      !isVisible);
  const { leaveDialogOpen, requestLeave, confirmLeave, cancelLeave } =
    useUnsavedChangesGuard(isDirty);

  function requestClose() {
    requestLeave(() => {
      setOpen(false);
      resetForm();
    });
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
        t("taxonomy.create.error.enterName", {
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
    const data = (await response?.json().catch(() => ({}))) as {
      category?: MerchantProductCategory;
      collection?: MerchantProductCollection;
      error?: string;
    };

    setIsSaving(false);

    if (!response?.ok) {
      setError(getTaxonomyCreateErrorMessage(entityLabel, data.error, t));
      return;
    }

    toast.success(t("taxonomy.create.success", { entity: capitalize(localizedEntity) }));
    setOpen(false);
    resetForm();
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: [queryKey] }),
      queryClient.invalidateQueries({ queryKey: ["product-taxonomy"] }),
    ]);
    onCreated?.({
      entityLabel,
      ...(data.category ? { category: data.category } : {}),
      ...(data.collection ? { collection: data.collection } : {}),
    });
    router.refresh();
  }

  return (
    <>
    <Dialog
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          setOpen(true);
          return;
        }
        requestClose();
      }}
      open={open}
    >
      {showTrigger ? (
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
      ) : null}
      <DialogContent
        className="z-[60] gap-0 overflow-visible p-0 sm:max-w-lg"
        overlayClassName="z-[60]"
      >
        <DialogHeader className="gap-1.5 border-b px-4 py-4 text-left sm:px-5">
          <DialogTitle>
            {t("taxonomy.create.title", { entity: localizedEntity })}
          </DialogTitle>
          <DialogDescription>
            {entityLabel === "category"
              ? t("taxonomy.create.category.desc")
              : t("taxonomy.create.collection.desc")}
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col"
          onSubmit={(event) => {
            // Nested inside product composer (and other host forms). Stop bubble so
            // the parent form does not submit with incomplete product values.
            event.preventDefault();
            event.stopPropagation();
            void submitTaxonomy();
          }}
        >
          <div className="grid gap-4 p-4 sm:p-5">
            {error ? (
              <Alert variant="destructive">
                <AlertTitle>
                  {t("taxonomy.create.error.createFailed", {
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
                {t("taxonomy.create.handle")}
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
                            ? t("taxonomy.create.unlockHandle")
                            : t("taxonomy.create.lockHandle")
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
                        ? t("taxonomy.create.unlockHandle")
                        : t("taxonomy.create.lockHandle")}
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        aria-label={t("taxonomy.create.regenerateHandle", {
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
                      {t("taxonomy.create.regenerateFrom", {
                        field: nameLabel.toLowerCase(),
                      })}
                    </TooltipContent>
                  </Tooltip>
                </InputGroupAddon>
              </InputGroup>
              <FieldDescription>
                {isHandleLocked
                  ? t("taxonomy.create.handleFollows", {
                      entity: localizedEntity,
                      field: nameLabel.toLowerCase(),
                    })
                  : t("taxonomy.create.handleCustom", { entity: localizedEntity })}
              </FieldDescription>
            </Field>

            {entityLabel === "category" ? (
              <Field>
                <FieldLabel>{t("taxonomy.create.parentCategory")}</FieldLabel>
                <ParentCategoryCombobox
                  onChange={setParentCategoryId}
                  options={sortedParents}
                  rootLabel={t("taxonomy.create.rootCategory")}
                  searchPlaceholder={t("taxonomy.create.searchParent")}
                  value={parentCategoryId}
                />
                <FieldDescription>{t("taxonomy.create.parentDesc")}</FieldDescription>
              </Field>
            ) : null}

            <Field className="flex flex-row items-center justify-between gap-4 rounded-xl border px-3.5 py-3">
              <div className="min-w-0 space-y-1">
                <FieldLabel className="text-sm" htmlFor={`taxonomy-${entityLabel}-visible`}>
                  {t("taxonomy.create.visibleLabel")}
                </FieldLabel>
                <FieldDescription className="text-xs">
                  {t("taxonomy.create.visibleDesc", {
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
              onClick={requestClose}
              type="button"
              variant="outline"
            >
              {t("common.cancel")}
            </Button>
            <Button disabled={isSaving} type="submit">
              {isSaving
                ? t("taxonomy.create.creating")
                : t("taxonomy.create.createBtn", { entity: localizedEntity })}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    <UnsavedChangesDialog
      onLeave={confirmLeave}
      onStay={cancelLeave}
      open={leaveDialogOpen}
    />
    </>
  );
}

function getTaxonomyCreateErrorMessage(
  entityLabel: "category" | "collection",
  error: string | undefined,
  t: (key: any, params?: any) => string,
) {
  const localizedEntity = t(`taxonomy.entity.${entityLabel}.label` as MessageKey);

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
