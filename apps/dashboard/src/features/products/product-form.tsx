"use client";

import type { MerchantProduct } from "@ecs/contracts";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { z } from "zod";
import { AppIcons } from "@/components/app/icons";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MediaUploadField } from "@/features/media/media-upload-field";
import {
  CategoryPicker,
  CollectionPicker,
  ComposerSection,
  FieldError,
  hasFieldError,
  StepDot,
} from "@/features/products/product-form-fields";
import {
  ProductOptionsBuilder,
  ProductReviewSummary,
  SimpleProductStockPreview,
  VariantMatrixTable,
} from "@/features/products/product-form-sections";
import {
  getDefaultSkuPrefix,
  getErrorMessage,
  getFirstInvalidFieldForStep,
  getProductDefaultValues,
  getProductMutationError,
  getProductPayload,
  getProductSuccessPath,
  getVariantRows,
  isInitialHandleLocked,
  ProductMutationError,
  slugifyProductHandle,
  validateInitialStock,
  validatePriceAmount,
  validateTitle,
} from "@/features/products/product-form-state";
import type { ComposerStep, ProductFormProps } from "@/features/products/product-form-types";
import { PRODUCT_STEPS, type productPayloadSchema } from "@/features/products/product-form-types";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";

export function ProductForm({
  action,
  categories,
  collections,
  notice,
  onClose,
  open = true,
  product,
  returnHref,
  submitLabel,
}: ProductFormProps) {
  const { t } = useI18n();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeStep, setActiveStep] = useState<ComposerStep["id"]>("details");
  const [completedSteps, setCompletedSteps] = useState<ComposerStep["id"][]>([]);
  const [isHandleLocked, setIsHandleLocked] = useState(isInitialHandleLocked(product));
  const [actionError, setActionError] = useState<string | null>(null);
  const [exitIntent, setExitIntent] = useState<(() => void) | null>(null);
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
        const payload = getProductPayload(value, { includeOptions: !product });

        await submitMutation.mutateAsync(payload);
      } catch (error) {
        const message = getErrorMessage(error);

        if (error instanceof ProductMutationError && error.step) {
          setActiveStep(error.step);
        }

        setActionError(message);
      }
    },
  });
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
        throw getProductMutationError(data.error, response.status);
      }

      const mediaResponse = await fetch(
        `/admin/media/products/${encodeURIComponent(data.product.id)}`,
        {
          body: JSON.stringify({
            imageUrls: payload.imageUrls,
            thumbnail: payload.thumbnail,
          }),
          headers: { "content-type": "application/json" },
          method: "POST",
        },
      );
      if (!mediaResponse.ok)
        toast.warning(t("products.composer.mediaSyncWarn"));

      return data.product;
    },
    onSuccess: async (savedProduct) => {
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      await queryClient.invalidateQueries({ queryKey: ["product", savedProduct.id] });
      toast.success(product ? t("products.composer.toastUpdated") : t("products.composer.toastCreated"));
      if (onClose) {
        onClose();
      } else {
        router.push(getProductSuccessPath(action, savedProduct.id, Boolean(product)));
      }
      router.refresh();
    },
  });
  const HandleLockIcon = isHandleLocked ? AppIcons.lock : AppIcons.lockUnlock;
  function requestExit(next: () => void) {
    if (form.state.isDirty && !submitMutation.isSuccess) {
      setExitIntent(() => next);
      return;
    }

    next();
  }

  function confirmExit() {
    const next = exitIntent;

    setExitIntent(null);
    next?.();
  }

  function cancelExit() {
    setExitIntent(null);
  }

  function closeComposer() {
    requestExit(() => {
      if (onClose) {
        onClose();
        return;
      }

      router.push(returnHref ?? getProductSuccessPath(action, product?.id ?? "", Boolean(product)));
    });
  }

  function moveToStep(stepId: ComposerStep["id"]) {
    if (stepId === activeStep) {
      return;
    }

    const currentIndex = PRODUCT_STEPS.findIndex((step) => step.id === activeStep);
    const targetIndex = PRODUCT_STEPS.findIndex((step) => step.id === stepId);

    if (targetIndex < currentIndex) {
      setActiveStep(stepId);
      return;
    }

    const invalidField = getFirstInvalidFieldForStep(activeStep, form.state.values);

    if (invalidField) {
      form.validateField(invalidField, "submit");
      return;
    }

    setCompletedSteps((current) =>
      current.includes(activeStep) ? current : [...current, activeStep],
    );
    setActiveStep(stepId);
  }

  function nextStep() {
    const currentIndex = PRODUCT_STEPS.findIndex((step) => step.id === activeStep);
    const next = PRODUCT_STEPS[currentIndex + 1];

    if (!next) {
      const invalidField = getFirstInvalidFieldForStep(activeStep, form.state.values);

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

  function updateTitle(nextTitle: string) {
    const currentTitle = form.state.values.title;
    const currentSkuPrefix = form.state.values.skuPrefix.trim();
    const shouldUpdateSkuPrefix =
      !product && (!currentSkuPrefix || currentSkuPrefix === getDefaultSkuPrefix(currentTitle));

    form.setFieldValue("title", nextTitle);

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
                        {status === "published" ? t("products.composer.published") : t("products.composer.draft")}
                      </Badge>
                    )}
                  </form.Subscribe>
                </div>
              </div>

              <div className="grid grid-cols-4 border-b lg:border-b-0">
                {steps.map((step) => (
                  <button
                    className={cn(
                      "flex min-h-11 min-w-0 flex-col items-center justify-center gap-1 border-r px-1.5 py-2 text-xs text-muted-foreground transition-colors last:border-r-0 hover:bg-muted/60 hover:text-foreground sm:min-h-12 sm:flex-row sm:gap-2 sm:px-3 sm:text-sm",
                      activeStep === step.id && "bg-muted text-foreground",
                    )}
                    key={step.id}
                    onClick={() => moveToStep(step.id)}
                    type="button"
                  >
                    <StepDot
                      status={
                        activeStep === step.id
                          ? "active"
                          : completedSteps.includes(step.id)
                            ? "complete"
                            : "idle"
                      }
                    />
                    <span className="max-w-full truncate sm:hidden">{step.shortLabel}</span>
                    <span className="hidden max-w-full truncate sm:inline">{step.label}</span>
                  </button>
                ))}
              </div>

              <div className="hidden items-center justify-end border-l p-3 lg:flex">
                <form.Subscribe selector={(state) => state.values.status}>
                  {(status) => (
                    <Badge variant={status === "published" ? "default" : "secondary"}>
                      {status === "published" ? t("products.composer.published") : t("products.composer.draft")}
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
                  {activeStep === "details" ? (
                    <section className="flex flex-col gap-5">
                      <ComposerSection
                        description={t("products.composer.basicsDesc")}
                        title={t("products.composer.basicsTitle")}
                      />

                      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                        <form.Field
                          name="title"
                          validators={{
                            onBlur: ({ value }) => validateTitle(value),
                            onSubmit: ({ value }) => validateTitle(value),
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
                            <Field>
                              <FieldLabel htmlFor={field.name}>
                                {t("products.composer.fieldHandle")}
                              </FieldLabel>
                              <InputGroup className="pr-1">
                                <InputGroupInput
                                  id={field.name}
                                  name={field.name}
                                  onBlur={field.handleBlur}
                                  onChange={(event) => {
                                    const nextHandle = slugifyProductHandle(event.target.value);
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
                              <FieldDescription>
                                {isHandleLocked
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
                            <Textarea
                              className="min-h-28"
                              id={field.name}
                              name={field.name}
                              onBlur={field.handleBlur}
                              onChange={(event) => field.handleChange(event.target.value)}
                              placeholder={t("products.composer.descriptionPlaceholder")}
                              value={field.state.value}
                            />
                          </Field>
                        )}
                      </form.Field>

                      <Separator />

                      <ComposerSection
                        description={t("products.composer.mediaDesc")}
                        title={t("products.composer.mediaTitle")}
                      />

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
                      <ComposerSection
                        description={t("products.composer.organizeDesc")}
                        title={t("products.composer.organizeTitle")}
                      />

                      <div className="grid gap-4 md:grid-cols-2">
                        <form.Field name="status">
                          {(field) => (
                            <Field>
                              <FieldLabel htmlFor={field.name}>
                                {t("products.composer.fieldStatus")}
                              </FieldLabel>
                              <Select
                                onValueChange={(value) =>
                                  field.handleChange(value === "published" ? "published" : "draft")
                                }
                                value={field.state.value}
                              >
                                <SelectTrigger className="w-full" id={field.name}>
                                  <SelectValue placeholder={t("products.composer.selectStatus")} />
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
                              <FieldLabel>{t("products.composer.fieldCollection")}</FieldLabel>
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
                            <FieldLegend variant="label">
                              {t("products.composer.fieldCategories")}
                            </FieldLegend>
                            <FieldDescription>
                              {t("products.composer.categoriesHelp")}
                            </FieldDescription>
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
                      <ComposerSection
                        description={t("products.composer.pricingDesc")}
                        title={t("products.composer.pricingTitle")}
                      />

                      <div className="rounded-2xl border bg-background p-4">
                        <div className="mb-4 flex flex-col gap-1">
                          <h3 className="text-sm font-medium">
                            {t("products.composer.defaultSellingTitle")}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {t("products.composer.defaultSellingDesc")}
                          </p>
                        </div>
                        <div className="grid gap-4 md:grid-cols-4">
                          <form.Field
                            name="priceAmount"
                            validators={{
                              onBlur: ({ value }) => validatePriceAmount(value),
                              onSubmit: ({ value }) => validatePriceAmount(value),
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
                              onBlur: ({ value }) => validateInitialStock(value),
                              onSubmit: ({ value }) => validateInitialStock(value),
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

                          <form.Field name="skuPrefix">
                            {(field) => (
                              <Field>
                                <FieldLabel htmlFor={field.name}>
                                  {t("products.composer.fieldSkuPrefix")}
                                </FieldLabel>
                                <Input
                                  id={field.name}
                                  name={field.name}
                                  onBlur={field.handleBlur}
                                  onChange={(event) => field.handleChange(event.target.value)}
                                  placeholder="TEE"
                                  value={field.state.value}
                                />
                              </Field>
                            )}
                          </form.Field>

                          <form.Field name="currencyCode">
                            {(field) => (
                              <Field data-disabled>
                                <FieldLabel htmlFor={field.name}>
                                  {t("products.composer.fieldCurrency")}
                                </FieldLabel>
                                <Input
                                  id={field.name}
                                  name={field.name}
                                  readOnly
                                  value={field.state.value.toUpperCase()}
                                />
                                <FieldDescription>
                                  {t("products.composer.currencyHelp")}
                                </FieldDescription>
                              </Field>
                            )}
                          </form.Field>
                        </div>
                      </div>

                      {!product ? (
                        <form.Field name="hasVariants">
                          {(field) => (
                            <div className="flex items-start justify-between gap-4 rounded-2xl border bg-muted/20 p-4">
                              <div className="max-w-2xl">
                                <h3 className="text-sm font-medium">
                                  {t("products.composer.hasVariantsTitle")}
                                </h3>
                                <p className="mt-1 text-sm text-muted-foreground">
                                  {t("products.composer.hasVariantsDesc")}
                                </p>
                              </div>
                              <Switch
                                aria-label={t("products.composer.enableVariantsAria")}
                                checked={field.state.value}
                                onCheckedChange={(checked) => {
                                  field.handleChange(checked);
                                  if (!checked) {
                                    form.setFieldValue("variantOverrides", {});
                                  }
                                }}
                              />
                            </div>
                          )}
                        </form.Field>
                      ) : null}

                      <form.Subscribe selector={(state) => state.values}>
                        {(values) =>
                          values.hasVariants ? (
                            <>
                              {!product ? (
                                <form.Field name="options">
                                  {(field) => (
                                    <ProductOptionsBuilder
                                      onChange={field.handleChange}
                                      options={field.state.value}
                                    />
                                  )}
                                </form.Field>
                              ) : null}

                              <VariantMatrixTable
                                onOverrideChange={(key, override) => {
                                  form.setFieldValue("variantOverrides", {
                                    ...values.variantOverrides,
                                    [key]: {
                                      ...values.variantOverrides[key],
                                      ...override,
                                    },
                                  });
                                }}
                                rows={getVariantRows(values)}
                                values={values.variantOverrides}
                              />
                            </>
                          ) : (
                            <SimpleProductStockPreview values={values} />
                          )
                        }
                      </form.Subscribe>
                    </section>
                  ) : null}

                  {activeStep === "review" ? (
                    <section className="flex flex-col gap-5">
                      <ComposerSection
                        description={t("products.composer.reviewDesc")}
                        title={t("products.composer.reviewTitle")}
                      />
                      <form.Subscribe selector={(state) => state.values}>
                        {(values) => <ProductReviewSummary values={values} />}
                      </form.Subscribe>
                    </section>
                  ) : null}
                </div>
              </div>

              <div className="z-20 flex shrink-0 flex-col gap-3 border-t bg-background p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-between sm:p-4 sm:pb-4">
                <form.Subscribe selector={(state) => state.isDirty}>
                  {(isDirty) =>
                    actionError ? (
                      <p className="flex items-center gap-2 text-sm font-medium text-destructive">
                        <AppIcons.error data-icon="inline-start" />
                        {actionError}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground sm:text-sm">
                        {isDirty ? t("products.composer.unsavedChanges") : t("products.composer.noUnsavedChanges")}
                      </p>
                    )
                  }
                </form.Subscribe>
                <div className={dialogFooterActionsClassName}>
                  <Button onClick={closeComposer} type="button" variant="outline">
                    {t("common.cancel")}
                  </Button>
                  <Button
                    disabled={submitMutation.isPending}
                    onClick={nextStep}
                    type="button"
                  >
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

      <AlertDialog
        onOpenChange={(open) => (!open ? cancelExit() : undefined)}
        open={Boolean(exitIntent)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("products.composer.leaveTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("products.composer.leaveDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelExit}>
              {t("products.composer.stay")}
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmExit} variant="destructive">
              {t("products.composer.leave")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function getMediaUrls(thumbnail: string, imageUrls: string) {
  return Array.from(
    new Set([thumbnail, ...imageUrls.split(/\r?\n/)].map((url) => url.trim()).filter(Boolean)),
  );
}
