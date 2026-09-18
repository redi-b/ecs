"use client";

import type { MerchantProduct } from "@ecs/contracts";
import { useForm, useStore } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { z } from "zod";
import { usePermission } from "@/components/app/access-context";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import {
  DialogStepPanel,
  DialogStepRail,
  getDialogStepStatus,
} from "@/components/app/dialog-step-rail";
import { HelpTip } from "@/components/app/help-tip";
import { AppIcons } from "@/components/app/icons";
import { UnsavedChangesDialog } from "@/components/app/unsaved-changes-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  dialogFooterActionsClassName,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MediaUploadField } from "@/features/media/media-upload-field";
import {
  CategoryPicker,
  CollectionPicker,
  ComposerSection,
  FieldError,
  hasFieldError,
} from "@/features/products/product-form-fields";
import {
  ProductOptionsWorkspace,
  ProductReviewSummary,
} from "@/features/products/product-form-sections";
import {
  getDefaultSkuPrefix,
  getErrorMessage,
  getFirstInvalidFieldForStep,
  getMediaUrls,
  getProductDefaultValues,
  getProductMutationError,
  getProductPayload,
  getProductSuccessPath,
  getRemovedExistingVariants,
  getVariantRows,
  isInitialHandleLocked,
  ProductMutationError,
  slugifyProductHandle,
  suggestAvailableProductHandle,
  validateInitialStock,
  validatePriceAmount,
  validateTitle,
} from "@/features/products/product-form-state";
import type { ComposerStep, ProductFormProps } from "@/features/products/product-form-types";
import { PRODUCT_STEPS, type productPayloadSchema } from "@/features/products/product-form-types";
import { useProductHandleAvailability } from "@/features/products/use-product-handle-availability";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import { useI18n } from "@/i18n/provider";

export function ProductForm({
  action,
  categories,
  collections,
  initialStep = "details",
  notice,
  offerTranslationAfterCreate = false,
  onClose,
  open = true,
  product,
  returnHref,
  submitLabel,
}: ProductFormProps) {
  const { t } = useI18n();
  const router = useRouter();
  const canTranslateProduct = usePermission("products.update");
  const queryClient = useQueryClient();
  const [activeStep, setActiveStep] = useState<ComposerStep["id"]>(initialStep);
  const [completedSteps, setCompletedSteps] = useState<ComposerStep["id"][]>([]);
  const [isHandleLocked, setIsHandleLocked] = useState(isInitialHandleLocked(product));
  const [actionError, setActionError] = useState<string | null>(null);
  const [suggestedHandle, setSuggestedHandle] = useState<string | null>(null);
  const [handleServerError, setHandleServerError] = useState<string | null>(null);
  const [adjustedHandle, setAdjustedHandle] = useState<string | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<{
    count: number;
    payload: z.infer<typeof productPayloadSchema>;
  } | null>(null);
  const defaultValues = useMemo(() => getProductDefaultValues(product), [product]);
  const steps = useMemo<ComposerStep[]>(
    () => [
      {
        id: "details",
        label: t("products.composer.stepDetails"),
        shortLabel: t("products.composer.stepDetailsShort"),
      },
      {
        id: "organize",
        label: t("products.composer.stepOrganize"),
        shortLabel: t("products.composer.stepOrganizeShort"),
      },
      {
        id: "variants",
        label: t("products.composer.stepVariants"),
        shortLabel: t("products.composer.stepVariantsShort"),
      },
      {
        id: "review",
        label: t("products.composer.stepReview"),
        shortLabel: t("products.composer.stepReviewShort"),
      },
    ],
    [t],
  );
  const form = useForm({
    defaultValues,
    onSubmit: async ({ value }) => {
      try {
        setActionError(null);
        setSuggestedHandle(null);
        const payload = getProductPayload(value, { includeOptions: true }, t);
        const removedVariants = product ? getRemovedExistingVariants(value) : [];

        if (removedVariants.length) {
          setPendingRemoval({ count: removedVariants.length, payload });
          return;
        }

        await savePayload(payload);
      } catch (error) {
        handleSaveError(error);
      }
    },
  });
  const currentHandle = useStore(form.store, (state) => state.values.handle);
  const handleAvailability = useProductHandleAvailability({
    action,
    currentHandle: product?.handle,
    handle: currentHandle,
    productId: product?.id,
  });
  useEffect(() => {
    if (handleAvailability.status !== "taken" || !handleAvailability.suggestedHandle) return;
    form.setFieldValue("handle", handleAvailability.suggestedHandle);
    setAdjustedHandle(handleAvailability.suggestedHandle);
  }, [form, handleAvailability.status, handleAvailability.suggestedHandle]);
  const submitMutation = useMutation({
    mutationFn: async (payload: z.infer<typeof productPayloadSchema>) => {
      const response = await fetch(action, {
        body: JSON.stringify(payload),
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        method: "POST",
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        product?: MerchantProduct;
      };

      if (!response.ok || !data.product) {
        throw getProductMutationError(data.error, response.status, t);
      }

      const mediaResponse = await fetch(
        `/dashboard/media/products/${encodeURIComponent(data.product.id)}`,
        {
          body: JSON.stringify({
            imageUrls: payload.imageUrls,
            thumbnail: payload.thumbnail,
          }),
          headers: { "content-type": "application/json" },
          method: "POST",
        },
      );
      if (!mediaResponse.ok) toast.warning(t("products.composer.mediaSyncWarn"));

      return data.product;
    },
    onSuccess: async (savedProduct) => {
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      await queryClient.invalidateQueries({ queryKey: ["product", savedProduct.id] });
      if (!product && offerTranslationAfterCreate && canTranslateProduct) {
        toast.success(t("products.composer.toastCreated"), {
          action: {
            label: t("products.composer.addAmharic"),
            onClick: () =>
              router.push(
                `/dashboard/products/${encodeURIComponent(savedProduct.id)}?translate=am`,
              ),
          },
        });
      } else {
        toast.success(
          product ? t("products.composer.toastUpdated") : t("products.composer.toastCreated"),
        );
      }
      if (onClose) {
        onClose();
      } else {
        router.push(getProductSuccessPath(action, savedProduct.id, Boolean(product)));
      }
      router.refresh();
    },
  });
  const HandleLockIcon = isHandleLocked ? AppIcons.lock : AppIcons.lockUnlock;
  const formHasChanges = useStore(form.store, (state) => !state.isDefaultValue);
  const isDirty = formHasChanges && !submitMutation.isSuccess;
  const { leaveDialogOpen, requestLeave, confirmLeave, cancelLeave } = useUnsavedChangesGuard(
    isDirty && open,
  );

  async function savePayload(payload: z.infer<typeof productPayloadSchema>) {
    try {
      await submitMutation.mutateAsync(payload);
    } catch (error) {
      handleSaveError(error);
    }
  }

  function handleSaveError(error: unknown) {
    const message = getErrorMessage(error, t);

    if (error instanceof ProductMutationError && error.step) {
      setActiveStep(error.step);
    }

    if (error instanceof ProductMutationError && error.code === "product_conflict") {
      setHandleServerError(message);
      setSuggestedHandle(suggestAvailableProductHandle(form.state.values.handle));
    }

    setActionError(message);
  }

  function closeComposer() {
    requestLeave(() => {
      if (onClose) {
        onClose();
        return;
      }

      router.push(returnHref ?? getProductSuccessPath(action, product?.id ?? "", Boolean(product)));
    });
  }

  /**
   * Step jump rules:
   * - Backward / revisit: always allowed
   * - Forward: validate every step from current through target-1; stop on first failure
   * - Locked-looking future steps still try the path (clearer than dead clicks)
   */
  function moveToStep(stepId: ComposerStep["id"]) {
    if (stepId === activeStep) {
      return;
    }

    const currentIndex = PRODUCT_STEPS.findIndex((step) => step.id === activeStep);
    const targetIndex = PRODUCT_STEPS.findIndex((step) => step.id === stepId);
    if (currentIndex < 0 || targetIndex < 0) return;

    if (targetIndex < currentIndex) {
      setActiveStep(stepId);
      return;
    }

    const nextCompleted = [...completedSteps];

    for (let i = currentIndex; i < targetIndex; i++) {
      const step = PRODUCT_STEPS[i]!;
      const invalidField = getFirstInvalidFieldForStep(step.id, form.state.values, t);

      if (invalidField) {
        setActiveStep(step.id);
        form.validateField(invalidField, "submit");
        return;
      }

      if (!nextCompleted.includes(step.id)) {
        nextCompleted.push(step.id);
      }
    }

    setCompletedSteps(nextCompleted);
    setActiveStep(stepId);
  }

  function nextStep() {
    const currentIndex = PRODUCT_STEPS.findIndex((step) => step.id === activeStep);
    const next = PRODUCT_STEPS[currentIndex + 1];

    if (!next) {
      const invalidField = getFirstInvalidFieldForStep(activeStep, form.state.values, t);

      if (invalidField) {
        form.validateField(invalidField, "submit");
        return;
      }

      setCompletedSteps((current) =>
        current.includes(activeStep) ? current : [...current, activeStep],
      );
      form.handleSubmit();
      return;
    }

    moveToStep(next.id);
  }

  function previousStep() {
    const currentIndex = PRODUCT_STEPS.findIndex((step) => step.id === activeStep);
    const prev = PRODUCT_STEPS[currentIndex - 1];
    if (prev) setActiveStep(prev.id);
  }

  function updateTitle(nextTitle: string) {
    const currentTitle = form.state.values.title;
    const currentSkuPrefix = form.state.values.skuPrefix.trim();
    const shouldUpdateSkuPrefix =
      !product && (!currentSkuPrefix || currentSkuPrefix === getDefaultSkuPrefix(currentTitle));

    form.setFieldValue("title", nextTitle);
    setAdjustedHandle(null);

    if (isHandleLocked) {
      form.setFieldValue("handle", slugifyProductHandle(nextTitle));
    }

    if (shouldUpdateSkuPrefix) {
      form.setFieldValue("skuPrefix", getDefaultSkuPrefix(nextTitle));
    }
  }

  function regenerateHandle() {
    const nextHandle = slugifyProductHandle(form.state.values.title);

    form.setFieldValue("handle", nextHandle);
    setAdjustedHandle(null);
    if (!product && !form.state.values.skuPrefix.trim()) {
      form.setFieldValue("skuPrefix", getDefaultSkuPrefix(nextHandle));
    }
    setIsHandleLocked(true);
  }

  return (
    <>
      <Dialog
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            closeComposer();
          }
        }}
        open={open}
      >
        <DialogContent
          className="top-0 left-0 flex h-dvh max-h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none p-0 duration-200 ease-out data-open:slide-in-from-bottom-2 sm:top-3 sm:left-3 sm:h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-1.5rem)] sm:w-[calc(100vw-1.5rem)] sm:max-w-none sm:rounded-2xl sm:data-open:slide-in-from-bottom-0"
          onEscapeKeyDown={(event) => {
            event.preventDefault();
            closeComposer();
          }}
          onInteractOutside={(event) => event.preventDefault()}
          showCloseButton={false}
        >
          <DialogTitle className="sr-only">
            {product ? t("products.composer.editTitle") : t("products.composer.createTitle")}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t("products.composer.dialogDesc")}
          </DialogDescription>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
            <div className="flex shrink-0 flex-col border-b bg-background lg:grid lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)_minmax(0,12rem)]">
              <div className="flex items-center gap-2 border-b p-3 lg:border-r lg:border-b-0">
                <Button
                  aria-label={t("products.composer.closeAria")}
                  onClick={closeComposer}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                >
                  <AppIcons.close data-icon="inline-start" />
                </Button>
                <Badge className="hidden h-6 rounded-md px-2 sm:inline-flex" variant="outline">
                  esc
                </Badge>
                <span className="min-w-0 truncate text-sm font-medium text-foreground sm:font-normal sm:text-muted-foreground">
                  {product ? t("products.composer.editTitle") : t("products.composer.createTitle")}
                </span>
                <div className="ml-auto lg:hidden">
                  <form.Subscribe selector={(state) => state.values.status}>
                    {(status) => (
                      <Badge variant={status === "published" ? "default" : "secondary"}>
                        {status === "published"
                          ? t("products.composer.published")
                          : t("products.composer.draft")}
                      </Badge>
                    )}
                  </form.Subscribe>
                </div>
              </div>

              <DialogStepRail
                ariaLabel={t("products.composer.stepsAria")}
                className="min-w-0 border-b lg:border-b-0"
                currentId={activeStep}
                getStatus={(_step, index) => {
                  const currentIndex = PRODUCT_STEPS.findIndex((s) => s.id === activeStep);
                  const completedIndexes = completedSteps
                    .map((id) => PRODUCT_STEPS.findIndex((s) => s.id === id))
                    .filter((i) => i >= 0);
                  return getDialogStepStatus({
                    index,
                    currentIndex,
                    completedIndexes,
                  });
                }}
                onSelect={(id) => moveToStep(id as ComposerStep["id"])}
                steps={steps}
              />

              <div className="hidden items-center justify-end border-l p-3 lg:flex">
                <form.Subscribe selector={(state) => state.values.status}>
                  {(status) => (
                    <Badge variant={status === "published" ? "default" : "secondary"}>
                      {status === "published"
                        ? t("products.composer.published")
                        : t("products.composer.draft")}
                    </Badge>
                  )}
                </form.Subscribe>
              </div>
            </div>

            <form
              className="flex min-h-0 flex-1 flex-col"
              onSubmit={(event) => {
                event.preventDefault();
                event.stopPropagation();
                form.handleSubmit();
              }}
            >
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-5 sm:py-10 md:px-8">
                  {notice}
                  <DialogStepPanel stepKey={activeStep}>
                    {activeStep === "details" ? (
                      <section className="flex flex-col gap-5">
                        <ComposerSection title={t("products.composer.basicsTitle")} />

                        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                          <form.Field
                            name="title"
                            validators={{
                              onBlur: ({ value }) => validateTitle(value, t),
                              onSubmit: ({ value }) => validateTitle(value, t),
                            }}
                          >
                            {(field) => (
                              <Field data-invalid={hasFieldError(field)}>
                                <FieldLabel htmlFor={field.name}>
                                  {t("products.composer.fieldTitle")}
                                </FieldLabel>
                                <Input
                                  aria-invalid={hasFieldError(field)}
                                  id={field.name}
                                  name={field.name}
                                  onBlur={field.handleBlur}
                                  onChange={(event) => updateTitle(event.target.value)}
                                  placeholder={t("products.composer.titlePlaceholder")}
                                  value={field.state.value}
                                />
                                <FieldError
                                  errors={field.state.meta.errors}
                                  touched={field.state.meta.isTouched}
                                />
                              </Field>
                            )}
                          </form.Field>

                          <form.Field name="handle">
                            {(field) => (
                              <Field data-invalid={Boolean(handleServerError)}>
                                <FieldLabel htmlFor={field.name}>
                                  {t("products.composer.fieldHandle")}
                                </FieldLabel>
                                <InputGroup className="pr-1">
                                  <InputGroupInput
                                    aria-invalid={Boolean(handleServerError)}
                                    id={field.name}
                                    name={field.name}
                                    onBlur={field.handleBlur}
                                    onChange={(event) => {
                                      const nextHandle = slugifyProductHandle(event.target.value);
                                      setAdjustedHandle(null);
                                      setHandleServerError(null);
                                      setSuggestedHandle(null);
                                      const currentSkuPrefix = form.state.values.skuPrefix.trim();
                                      const shouldUpdateSkuPrefix =
                                        !product &&
                                        (!currentSkuPrefix ||
                                          currentSkuPrefix ===
                                            getDefaultSkuPrefix(field.state.value) ||
                                          currentSkuPrefix ===
                                            getDefaultSkuPrefix(form.state.values.title));

                                      field.handleChange(nextHandle);

                                      if (shouldUpdateSkuPrefix) {
                                        form.setFieldValue(
                                          "skuPrefix",
                                          getDefaultSkuPrefix(nextHandle),
                                        );
                                      }
                                    }}
                                    placeholder={t("products.composer.handlePlaceholder")}
                                    readOnly={isHandleLocked}
                                    value={field.state.value}
                                  />
                                  <InputGroupAddon align="inline-end" className="gap-1 py-0 pr-0">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          aria-label={
                                            isHandleLocked
                                              ? t("products.composer.unlockHandle")
                                              : t("products.composer.lockHandle")
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
                                          ? t("products.composer.unlockHandle")
                                          : t("products.composer.lockHandle")}
                                      </TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          aria-label={t("products.composer.regenerateHandle")}
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
                                        {t("products.composer.regenerateFromTitle")}
                                      </TooltipContent>
                                    </Tooltip>
                                  </InputGroupAddon>
                                </InputGroup>
                                {handleServerError ? (
                                  <FieldError errors={[{ message: handleServerError }]} touched />
                                ) : null}
                                <FieldDescription>
                                  {adjustedHandle
                                    ? t("products.validation.handleAdjusted", { handle: adjustedHandle })
                                    : isHandleLocked
                                      ? t("products.composer.autoHandle")
                                      : t("products.composer.customHandle")}
                                </FieldDescription>
                              </Field>
                            )}
                          </form.Field>
                        </div>

                        <form.Field name="description">
                          {(field) => (
                            <Field>
                              <FieldLabel htmlFor={field.name}>
                                {t("products.composer.fieldDescription")}
                              </FieldLabel>
                              <RichTextEditor
                                aria-label={t("products.composer.fieldDescription")}
                                id={field.name}
                                onBlur={field.handleBlur}
                                onChange={field.handleChange}
                                placeholder={t("products.composer.descriptionPlaceholder")}
                                value={field.state.value}
                              />
                            </Field>
                          )}
                        </form.Field>

                        <Separator />

                        <ComposerSection title={t("products.composer.mediaTitle")} />

                        <form.Subscribe
                          selector={(state) =>
                            [state.values.thumbnail, state.values.imageUrls] as const
                          }
                        >
                          {([thumbnail, imageUrls]) => (
                            <MediaUploadField
                              imageUrls={getMediaUrls(thumbnail, imageUrls)}
                              onImageUrlsChange={(urls) =>
                                form.setFieldValue("imageUrls", urls.join("\n"))
                              }
                              onThumbnailChange={(url) => form.setFieldValue("thumbnail", url)}
                              thumbnail={thumbnail}
                            />
                          )}
                        </form.Subscribe>
                      </section>
                    ) : null}

                    {activeStep === "organize" ? (
                      <section className="flex flex-col gap-5">
                        <ComposerSection title={t("products.composer.organizeTitle")} />

                        <div className="grid gap-4 md:grid-cols-2">
                          <form.Field name="status">
                            {(field) => (
                              <Field>
                                <FieldLabel htmlFor={field.name}>
                                  {t("products.composer.fieldStatus")}
                                </FieldLabel>
                                <Select
                                  onValueChange={(value) =>
                                    field.handleChange(
                                      value === "published" ? "published" : "draft",
                                    )
                                  }
                                  value={field.state.value}
                                >
                                  <SelectTrigger className="w-full" id={field.name}>
                                    <SelectValue
                                      placeholder={t("products.composer.selectStatus")}
                                    />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectGroup>
                                      <SelectItem value="draft">
                                        {t("products.composer.draft")}
                                      </SelectItem>
                                      <SelectItem value="published">
                                        {t("products.composer.published")}
                                      </SelectItem>
                                    </SelectGroup>
                                  </SelectContent>
                                </Select>
                              </Field>
                            )}
                          </form.Field>

                          <form.Field name="collectionId">
                            {(field) => (
                              <Field>
                                <FieldLabel className="flex items-center gap-1.5">
                                  {t("products.composer.fieldCollection")}
                                  <HelpTip
                                    label={t("products.composer.collectionHelpLabel")}
                                    summary={t("products.composer.collectionHelp")}
                                  />
                                </FieldLabel>
                                <CollectionPicker
                                  collections={collections}
                                  onChange={field.handleChange}
                                  selectedCollection={collections.find(
                                    (collection) => collection.id === field.state.value,
                                  )}
                                  value={field.state.value}
                                />
                              </Field>
                            )}
                          </form.Field>
                        </div>

                        <form.Field name="categoryIds">
                          {(field) => (
                            <FieldSet>
                              <FieldLegend className="flex items-center gap-1.5" variant="label">
                                {t("products.composer.fieldCategories")}
                                <HelpTip
                                  label={t("products.composer.categoriesHelpLabel")}
                                  summary={t("products.composer.categoriesHelp")}
                                />
                              </FieldLegend>
                              <CategoryPicker
                                categories={categories}
                                onChange={field.handleChange}
                                selectedCategories={categories.filter((category) =>
                                  field.state.value.includes(category.id),
                                )}
                                value={field.state.value}
                              />
                            </FieldSet>
                          )}
                        </form.Field>
                      </section>
                    ) : null}

                    {activeStep === "variants" ? (
                      <section className="flex flex-col gap-5">
                        <ComposerSection title={t("products.composer.pricingTitle")} />

                        <form.Field name="hasVariants">
                          {(field) => (
                            <Field className="max-w-xl">
                              <FieldLabel>{t("products.composer.hasVariantsTitle")}</FieldLabel>
                              <SegmentedControl
                                active="muted"
                                ariaLabel={t("products.composer.enableVariantsAria")}
                                onChange={(value) => {
                                  const hasVariants = value === "choices";
                                  field.handleChange(hasVariants);
                                  if (!hasVariants && !product) {
                                    form.setFieldValue("variantOverrides", {});
                                  }
                                }}
                                options={[
                                  {
                                    id: "single",
                                    label: t("products.composer.singleProductChoice"),
                                  },
                                  {
                                    id: "choices",
                                    label: t("products.composer.variantProductChoice"),
                                  },
                                ]}
                                value={field.state.value ? "choices" : "single"}
                              />
                            </Field>
                          )}
                        </form.Field>

                        <div className="rounded-2xl border bg-background p-4">
                          <div className="mb-4">
                            <h3 className="text-sm font-medium">
                              {t("products.composer.defaultSellingTitle")}
                            </h3>
                          </div>
                          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            <form.Field
                              name="priceAmount"
                              validators={{
                                onBlur: ({ value }) => validatePriceAmount(value, t),
                                onSubmit: ({ value }) => validatePriceAmount(value, t),
                              }}
                            >
                              {(field) => (
                                <Field data-invalid={hasFieldError(field)}>
                                  <FieldLabel htmlFor={field.name}>
                                    {t("products.composer.fieldPrice")}
                                  </FieldLabel>
                                  <InputGroup>
                                    <InputGroupAddon>ETB</InputGroupAddon>
                                    <InputGroupInput
                                      aria-invalid={hasFieldError(field)}
                                      id={field.name}
                                      inputMode="numeric"
                                      min="0"
                                      name={field.name}
                                      onBlur={field.handleBlur}
                                      onChange={(event) => field.handleChange(event.target.value)}
                                      placeholder="0"
                                      type="text"
                                      value={field.state.value}
                                    />
                                  </InputGroup>
                                  <FieldError
                                    errors={field.state.meta.errors}
                                    touched={field.state.meta.isTouched}
                                  />
                                </Field>
                              )}
                            </form.Field>

                            <form.Field
                              name="initialStock"
                              validators={{
                                onBlur: ({ value }) => validateInitialStock(value, t),
                                onSubmit: ({ value }) => validateInitialStock(value, t),
                              }}
                            >
                              {(field) => (
                                <Field data-invalid={hasFieldError(field)}>
                                  <FieldLabel htmlFor={field.name}>
                                    {t("products.composer.fieldStocked")}
                                  </FieldLabel>
                                  <Input
                                    aria-invalid={hasFieldError(field)}
                                    id={field.name}
                                    inputMode="numeric"
                                    min="0"
                                    name={field.name}
                                    onBlur={field.handleBlur}
                                    onChange={(event) => field.handleChange(event.target.value)}
                                    placeholder="0"
                                    type="text"
                                    value={field.state.value}
                                  />
                                  <FieldError
                                    errors={field.state.meta.errors}
                                    touched={field.state.meta.isTouched}
                                  />
                                </Field>
                              )}
                            </form.Field>

                            <form.Subscribe selector={(state) => state.values.hasVariants}>
                              {(hasVariants) =>
                                !hasVariants ? (
                                  <form.Field name="skuPrefix">
                                    {(field) => (
                                      <Field>
                                        <FieldLabel htmlFor={field.name}>
                                          {t("products.composer.fieldSkuOptional")}
                                        </FieldLabel>
                                        <Input
                                          id={field.name}
                                          name={field.name}
                                          onBlur={field.handleBlur}
                                          onChange={(event) =>
                                            field.handleChange(event.target.value)
                                          }
                                          placeholder={t(
                                            "products.composer.skuOptionalPlaceholder",
                                          )}
                                          value={field.state.value}
                                        />
                                      </Field>
                                    )}
                                  </form.Field>
                                ) : null
                              }
                            </form.Subscribe>
                          </div>
                        </div>

                        <form.Subscribe selector={(state) => state.values}>
                          {(values) =>
                            values.hasVariants ? (
                              <>
                                <form.Field name="options">
                                  {(field) => (
                                    <ProductOptionsWorkspace
                                      onApplyDefaults={() => {
                                        const rows = getVariantRows(values);
                                        form.setFieldValue(
                                          "variantOverrides",
                                          Object.fromEntries(
                                            rows.map((row) => [
                                              row.key,
                                              {
                                                ...values.variantOverrides[row.key],
                                                priceAmount: values.priceAmount,
                                                stockedQuantity: values.initialStock,
                                              },
                                            ]),
                                          ),
                                        );
                                      }}
                                      onOptionsChange={field.handleChange}
                                      onOverrideChange={(key, override) => {
                                        form.setFieldValue("variantOverrides", {
                                          ...values.variantOverrides,
                                          [key]: {
                                            ...values.variantOverrides[key],
                                            ...override,
                                          },
                                        });
                                      }}
                                      options={field.state.value}
                                      rows={getVariantRows(values)}
                                      values={values.variantOverrides}
                                    />
                                  )}
                                </form.Field>
                              </>
                            ) : null
                          }
                        </form.Subscribe>
                      </section>
                    ) : null}

                    {activeStep === "review" ? (
                      <section className="flex flex-col gap-5">
                        <ComposerSection title={t("products.composer.reviewTitle")} />
                        <form.Subscribe selector={(state) => state.values}>
                          {(values) => <ProductReviewSummary values={values} />}
                        </form.Subscribe>
                      </section>
                    ) : null}
                  </DialogStepPanel>
                </div>
              </div>

              <div className="z-20 flex shrink-0 flex-col gap-3 border-t bg-background p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-between sm:p-4 sm:pb-4">
                <form.Subscribe selector={(state) => !state.isDefaultValue}>
                  {(isDirty) =>
                    actionError ? (
                      <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-destructive">
                        <p className="flex items-center gap-2">
                          <AppIcons.error data-icon="inline-start" />
                          {actionError}
                        </p>
                        {suggestedHandle ? (
                          <Button
                            onClick={() => {
                              form.setFieldValue("handle", suggestedHandle);
                              setIsHandleLocked(false);
                              setActionError(null);
                              setHandleServerError(null);
                              setSuggestedHandle(null);
                            }}
                            size="sm"
                            type="button"
                            variant="outline"
                          >
                            {t("products.composer.useSuggestedHandle", {
                              handle: suggestedHandle,
                            })}
                          </Button>
                        ) : null}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground sm:text-sm">
                        {isDirty
                          ? t("products.composer.unsavedChanges")
                          : t("products.composer.noUnsavedChanges")}
                      </p>
                    )
                  }
                </form.Subscribe>
                <div className={dialogFooterActionsClassName}>
                  {activeStep === "details" ? (
                    <Button onClick={closeComposer} type="button" variant="outline">
                      {t("common.cancel")}
                    </Button>
                  ) : (
                    <Button onClick={previousStep} type="button" variant="outline">
                      {t("common.back")}
                    </Button>
                  )}
                  <Button disabled={submitMutation.isPending} onClick={nextStep} type="button">
                    {submitMutation.isPending
                      ? t("products.composer.saving")
                      : activeStep === "review"
                        ? submitLabel
                        : t("products.composer.continue")}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      <UnsavedChangesDialog onLeave={confirmLeave} onStay={cancelLeave} open={leaveDialogOpen} />
      <ConfirmDialog
        confirmLabel={t("products.formReview.confirmVariantRemoval")}
        description={t("products.formReview.confirmVariantRemovalDesc", {
          count: pendingRemoval?.count ?? 0,
        })}
        onConfirm={() => {
          const payload = pendingRemoval?.payload;
          setPendingRemoval(null);
          if (payload) void savePayload(payload);
        }}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setPendingRemoval(null);
        }}
        open={Boolean(pendingRemoval)}
        title={t("products.formReview.confirmVariantRemovalTitle")}
      />
    </>
  );
}
