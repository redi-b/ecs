"use client";

import type {
  MerchantProduct,
  MerchantProductCategory,
  MerchantProductCollection,
} from "@ecs/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import { type ReactNode, useMemo, useState } from "react";
import { z } from "zod";

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
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  CategoryPicker,
  CollectionPicker,
  ComposerSection,
  FieldError,
  hasFieldError,
  NO_COLLECTION_VALUE,
  StepDot,
} from "@/features/products/product-form-fields";
import {
  buildVariantMatrix,
  type ProductOptionDraft,
  type VariantMatrixRow,
} from "@/features/products/product-variant-matrix";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type ProductFormProps = {
  action: string;
  categories: MerchantProductCategory[];
  collections: MerchantProductCollection[];
  notice?: ReactNode;
  onClose?: (() => void) | undefined;
  open?: boolean | undefined;
  product?: MerchantProduct | undefined;
  returnHref?: string | undefined;
  submitLabel: string;
};

type ProductFormValues = {
  title: string;
  description: string;
  handle: string;
  thumbnail: string;
  imageUrls: string;
  status: "draft" | "published";
  priceAmount: string;
  currencyCode: "etb";
  initialStock: string;
  options: ProductOptionDraft[];
  skuPrefix: string;
  variantOverrides: Record<
    string,
    {
      priceAmount?: string | undefined;
      sku?: string | undefined;
      stockedQuantity?: string | undefined;
    }
  >;
  collectionId: string;
  categoryIds: string[];
};

type ComposerStep = {
  id: "details" | "organize" | "variants" | "review";
  label: string;
};

const PRODUCT_STEPS: ComposerStep[] = [
  { id: "details", label: "Details" },
  { id: "organize", label: "Organize" },
  { id: "variants", label: "Variants" },
  { id: "review", label: "Review" },
];

const productPayloadSchema = z.object({
  title: z.string().trim().min(1, "Enter a product title."),
  description: z.string().trim().nullable(),
  handle: z.string().trim().nullable(),
  thumbnail: z.string().trim().nullable(),
  imageUrls: z
    .array(z.string().trim().url("Use full image URLs that start with http:// or https://."))
    .optional(),
  status: z.enum(["draft", "published"]),
  priceAmount: z.number().int().nonnegative("Price cannot be negative."),
  currencyCode: z.literal("etb"),
  options: z
    .array(
      z.object({
        title: z.string().trim().min(1, "Enter an option name."),
        values: z.array(z.string().trim().min(1)).min(1, "Enter at least one option value."),
      }),
    )
    .optional(),
  variants: z
    .array(
      z.object({
        optionValues: z.record(z.string().min(1), z.string().min(1)),
        sku: z.string().trim().nullable(),
        priceAmount: z.number().int().nonnegative("Price cannot be negative."),
        currencyCode: z.literal("etb"),
        stockedQuantity: z.number().int().nonnegative("Stock cannot be negative."),
      }),
    )
    .optional(),
  collectionId: z.string().trim().nullable(),
  categoryIds: z.array(z.string().min(1)),
});

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
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeStep, setActiveStep] = useState<ComposerStep["id"]>("details");
  const [completedSteps, setCompletedSteps] = useState<ComposerStep["id"][]>([]);
  const [isHandleLocked, setIsHandleLocked] = useState(isInitialHandleLocked(product));
  const [actionError, setActionError] = useState<string | null>(null);
  const [exitIntent, setExitIntent] = useState<(() => void) | null>(null);
  const defaultValues = useMemo(() => getProductDefaultValues(product), [product]);
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

      return data.product;
    },
    onSuccess: async (savedProduct) => {
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      await queryClient.invalidateQueries({ queryKey: ["product", savedProduct.id] });
      toast.success(product ? "Product updated." : "Product created.");
      if (onClose) {
        onClose();
      } else {
        router.push(getProductSuccessPath(action, savedProduct.id, Boolean(product)));
      }
      router.refresh();
    },
  });
  const HandleLockIcon = isHandleLocked ? AppIcons.lock : AppIcons.lockUnlock;
  const variantRows = getVariantRows(form.state.values);

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
    form.setFieldValue("title", nextTitle);

    if (isHandleLocked) {
      form.setFieldValue("handle", slugifyProductHandle(nextTitle));
    }
  }

  function regenerateHandle() {
    form.setFieldValue("handle", slugifyProductHandle(form.state.values.title));
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
            {product ? "Edit product" : "Create product"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Complete product details, organization, variants, and review before saving.
          </DialogDescription>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
            <div className="grid shrink-0 border-b bg-background/95 backdrop-blur lg:grid-cols-[18rem_1fr_18rem]">
              <div className="flex items-center gap-2 border-b p-3 lg:border-r lg:border-b-0">
                <Button
                  aria-label="Close product composer"
                  onClick={closeComposer}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                >
                  <AppIcons.close data-icon="inline-start" />
                </Button>
                <Badge className="h-6 rounded-md px-2" variant="outline">
                  esc
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {product ? "Edit product" : "Create product"}
                </span>
              </div>

              <div className="grid grid-cols-4">
                {PRODUCT_STEPS.map((step) => (
                  <button
                    className={cn(
                      "flex min-h-12 items-center justify-center gap-2 border-r px-3 text-sm text-muted-foreground transition-colors last:border-r-0 hover:bg-muted/60 hover:text-foreground",
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
                    <span className="truncate">{step.label}</span>
                  </button>
                ))}
              </div>

              <div className="hidden items-center justify-end border-l p-3 lg:flex">
                <form.Subscribe selector={(state) => state.values.status}>
                  {(status) => (
                    <Badge variant={status === "published" ? "default" : "secondary"}>
                      {status === "published" ? "Published" : "Draft"}
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
              <div className="min-h-0 flex-1 overflow-y-auto">
                <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col gap-8 px-5 py-10 md:px-8">
                  {notice}
            {activeStep === "details" ? (
              <section className="flex flex-col gap-5">
                <ComposerSection
                  description="Start with the information shoppers will recognize first."
                  title="General"
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
                        <FieldLabel htmlFor={field.name}>Title</FieldLabel>
                        <Input
                          aria-invalid={hasFieldError(field)}
                          id={field.name}
                          name={field.name}
                          onBlur={field.handleBlur}
                          onChange={(event) => updateTitle(event.target.value)}
                          placeholder="Coffee beans"
                          value={field.state.value}
                        />
                        <FieldError errors={field.state.meta.errors} touched={field.state.meta.isTouched} />
                      </Field>
                    )}
                  </form.Field>

                  <form.Field name="handle">
                    {(field) => (
                      <Field>
                        <FieldLabel htmlFor={field.name}>Handle</FieldLabel>
                        <InputGroup className="pr-1">
                          <InputGroupInput
                            id={field.name}
                            name={field.name}
                            onBlur={field.handleBlur}
                            onChange={(event) =>
                              field.handleChange(slugifyProductHandle(event.target.value))
                            }
                            placeholder="coffee-beans"
                            readOnly={isHandleLocked}
                            value={field.state.value}
                          />
                          <InputGroupAddon align="inline-end" className="gap-1 py-0 pr-0">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  aria-label={
                                    isHandleLocked ? "Unlock handle editing" : "Lock handle editing"
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
                                {isHandleLocked ? "Unlock handle editing" : "Lock handle editing"}
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  aria-label="Regenerate handle from title"
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
                                Regenerate from title
                              </TooltipContent>
                            </Tooltip>
                          </InputGroupAddon>
                        </InputGroup>
                        <FieldDescription>
                          {isHandleLocked
                            ? "The handle follows the title automatically."
                            : "Handle editing is unlocked for a custom storefront slug."}
                        </FieldDescription>
                      </Field>
                    )}
                  </form.Field>
                </div>

                <form.Field name="description">
                  {(field) => (
                    <Field>
                      <FieldLabel htmlFor={field.name}>Description</FieldLabel>
                      <Textarea
                        className="min-h-28"
                        id={field.name}
                        name={field.name}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value)}
                        placeholder="Describe the product for the storefront."
                        value={field.state.value}
                      />
                    </Field>
                  )}
                </form.Field>

                <Separator />

                <ComposerSection
                  description="Use image URLs for now. Upload support can replace this without changing the composer shape."
                  title="Media"
                />

                <div className="grid gap-4 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                  <form.Field name="thumbnail">
                    {(field) => (
                      <Field>
                        <FieldLabel htmlFor={field.name}>Thumbnail URL</FieldLabel>
                        <Input
                          id={field.name}
                          name={field.name}
                          onBlur={field.handleBlur}
                          onChange={(event) => field.handleChange(event.target.value)}
                          placeholder="https://cdn.example.com/product.jpg"
                          type="url"
                          value={field.state.value}
                        />
                      </Field>
                    )}
                  </form.Field>

                  <form.Field
                    name="imageUrls"
                    validators={{
                      onBlur: ({ value }) => validateImageUrls(value),
                      onSubmit: ({ value }) => validateImageUrls(value),
                    }}
                  >
                    {(field) => (
                      <Field data-invalid={hasFieldError(field)}>
                        <FieldLabel htmlFor={field.name}>Image URLs</FieldLabel>
                        <Textarea
                          aria-invalid={hasFieldError(field)}
                          className="min-h-28"
                          id={field.name}
                          name={field.name}
                          onBlur={field.handleBlur}
                          onChange={(event) => field.handleChange(event.target.value)}
                          placeholder={"https://cdn.example.com/front.jpg\nhttps://cdn.example.com/back.jpg"}
                          value={field.state.value}
                        />
                        <FieldDescription>Enter one image URL per line.</FieldDescription>
                        <FieldError errors={field.state.meta.errors} touched={field.state.meta.isTouched} />
                      </Field>
                    )}
                  </form.Field>
                </div>
              </section>
            ) : null}

            {activeStep === "organize" ? (
              <section className="flex flex-col gap-5">
                <ComposerSection
                  description="Keep products easy to find in the dashboard and storefront."
                  title="Organize"
                />

                <div className="grid gap-4 md:grid-cols-2">
                  <form.Field name="status">
                    {(field) => (
                      <Field>
                        <FieldLabel htmlFor={field.name}>Status</FieldLabel>
                        <Select
                          onValueChange={(value) =>
                            field.handleChange(value === "published" ? "published" : "draft")
                          }
                          value={field.state.value}
                        >
                          <SelectTrigger className="w-full" id={field.name}>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              <SelectItem value="draft">Draft</SelectItem>
                              <SelectItem value="published">Published</SelectItem>
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </Field>
                    )}
                  </form.Field>

                  <form.Field name="collectionId">
                    {(field) => (
                      <Field>
                        <FieldLabel>Collection</FieldLabel>
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
                      <FieldLegend variant="label">Categories</FieldLegend>
                      <FieldDescription>Select all categories that apply.</FieldDescription>
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
                  description="Define option groups, then apply default price, SKU, and stock values to every generated variant."
                  title="Variants"
                />

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

                <div className="rounded-2xl border bg-background p-4 shadow-sm shadow-primary/5">
                  <div className="mb-4 flex flex-col gap-1">
                    <h3 className="text-sm font-medium">Variant defaults</h3>
                    <p className="text-sm text-muted-foreground">
                      These values apply to every generated row. Override a row only when it differs.
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
                          <FieldLabel htmlFor={field.name}>Price</FieldLabel>
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
                          <FieldError errors={field.state.meta.errors} touched={field.state.meta.isTouched} />
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
                          <FieldLabel htmlFor={field.name}>Stocked</FieldLabel>
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
                          <FieldLabel htmlFor={field.name}>SKU prefix</FieldLabel>
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
                          <FieldLabel htmlFor={field.name}>Currency</FieldLabel>
                          <Input
                            id={field.name}
                            name={field.name}
                            readOnly
                            value={field.state.value.toUpperCase()}
                          />
                          <FieldDescription>Fixed for this merchant market.</FieldDescription>
                        </Field>
                      )}
                    </form.Field>
                  </div>
                </div>

                <VariantMatrixTable
                  onOverrideChange={(key, override) => {
                    form.setFieldValue("variantOverrides", {
                      ...form.state.values.variantOverrides,
                      [key]: {
                        ...form.state.values.variantOverrides[key],
                        ...override,
                      },
                    });
                  }}
                  rows={variantRows}
                  values={form.state.values.variantOverrides}
                />
              </section>
            ) : null}

            {activeStep === "review" ? (
              <section className="flex flex-col gap-5">
                <ComposerSection
                  description="Review the generated product variants before saving."
                  title="Review"
                />
                <div className="rounded-lg border p-4">
                  <p className="text-sm text-muted-foreground">
                    {variantRows.length} variant{variantRows.length === 1 ? "" : "s"} will be saved
                    with default price, SKU, and stock settings.
                  </p>
                </div>
              </section>
            ) : null}
                </div>
              </div>

              <div className="z-20 flex shrink-0 flex-col gap-3 border-t bg-background/95 p-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
                <form.Subscribe selector={(state) => state.isDirty}>
                  {(isDirty) => (
                    actionError ? (
                      <p className="flex items-center gap-2 text-sm font-medium text-destructive">
                        <AppIcons.error data-icon="inline-start" />
                        {actionError}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {isDirty ? "Unsaved changes" : "No unsaved changes"}
                      </p>
                    )
                  )}
                </form.Subscribe>
                <div className="flex justify-end gap-2">
                  <Button onClick={closeComposer} type="button" variant="outline">
                    Cancel
                  </Button>
                  <Button disabled={submitMutation.isPending} onClick={nextStep} type="button">
                    {submitMutation.isPending
                      ? "Saving..."
                      : activeStep === "review"
                        ? submitLabel
                        : "Continue"}
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
            <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
            <AlertDialogDescription>Changes you made will be lost.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelExit}>Stay</AlertDialogCancel>
            <AlertDialogAction onClick={confirmExit} variant="destructive">
              Leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ProductOptionsBuilder({
  onChange,
  options,
}: {
  onChange: (options: ProductOptionDraft[]) => void;
  options: ProductOptionDraft[];
}) {
  const [draftValues, setDraftValues] = useState<Record<number, string>>({});

  function addOption(title = "") {
    onChange([...options, { title, values: [] }]);
  }

  function updateOption(index: number, nextOption: ProductOptionDraft) {
    const next = [...options];

    next[index] = nextOption;
    onChange(next);
  }

  function addValues(index: number, rawValue: string) {
    const values = rawValue
      .split(/[\n,]/)
      .map((value) => value.trim())
      .filter(Boolean);

    if (!values.length) {
      return;
    }

    const option = options[index];

    if (!option) {
      return;
    }

    updateOption(index, {
      ...option,
      values: [...new Set([...option.values, ...values])],
    });
    setDraftValues((current) => ({ ...current, [index]: "" }));
  }

  function removeValue(index: number, value: string) {
    const option = options[index];

    if (!option) {
      return;
    }

    updateOption(index, {
      ...option,
      values: option.values.filter((currentValue) => currentValue !== value),
    });
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border bg-muted/20 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="max-w-2xl">
          <h3 className="text-sm font-medium">Product options</h3>
          <p className="text-sm text-muted-foreground">
            Add the attributes shoppers choose from. Each value combination becomes a variant.
          </p>
        </div>
        <Button
          onClick={() => addOption()}
          size="sm"
          type="button"
          variant="outline"
        >
          Add option
        </Button>
      </div>

      {options.length ? (
        <div className="flex flex-col gap-3">
          {options.map((option, index) => (
            <div
              className="rounded-xl border bg-background p-4 shadow-sm shadow-primary/5"
              key={index}
            >
              <div className="grid gap-4 md:grid-cols-[14rem_minmax(0,1fr)_auto] md:items-start">
                <Field>
                  <FieldLabel>Option name</FieldLabel>
                  <Input
                    onChange={(event) => updateOption(index, { ...option, title: event.target.value })}
                    placeholder={index === 0 ? "Size" : "Color"}
                    value={option.title}
                  />
                </Field>

                <Field>
                  <FieldLabel>Values</FieldLabel>
                  <div className="flex min-h-10 flex-wrap items-center gap-2 rounded-lg border bg-muted/20 px-2 py-2">
                    {option.values.map((value) => (
                      <Badge
                        className="gap-1 rounded-md px-2 py-1"
                        key={value}
                        variant="secondary"
                      >
                        {value}
                        <button
                          aria-label={`Remove ${value}`}
                          className="ml-1 rounded-sm text-muted-foreground hover:text-foreground"
                          onClick={() => removeValue(index, value)}
                          type="button"
                        >
                          <AppIcons.close className="size-3" />
                        </button>
                      </Badge>
                    ))}
                    <input
                      aria-label={`Add value for ${option.title || "option"}`}
                      className="min-w-32 flex-1 bg-transparent px-1 py-1 text-sm outline-none placeholder:text-muted-foreground"
                      onChange={(event) =>
                        setDraftValues((current) => ({
                          ...current,
                          [index]: event.target.value,
                        }))
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === ",") {
                          event.preventDefault();
                          addValues(index, draftValues[index] ?? "");
                        }
                      }}
                      onPaste={(event) => {
                        const pastedText = event.clipboardData.getData("text");

                        if (/[\n,]/.test(pastedText)) {
                          event.preventDefault();
                          addValues(index, pastedText);
                        }
                      }}
                      placeholder={option.values.length ? "Add another value" : "Small, Medium, Large"}
                      value={draftValues[index] ?? ""}
                    />
                  </div>
                  <FieldDescription>
                    Press Enter or comma to add a value. Paste a comma-separated list to add many.
                  </FieldDescription>
                </Field>

                <Button
                  className="md:mt-6"
                  onClick={() => onChange(options.filter((_, optionIndex) => optionIndex !== index))}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed bg-background px-4 py-5">
          <p className="text-sm font-medium">No options yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a simple product, or add common option groups to generate a variant matrix.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {["Size", "Color", "Material"].map((title) => (
              <Button
                key={title}
                onClick={() => addOption(title)}
                size="sm"
                type="button"
                variant="outline"
              >
                Add {title}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function VariantMatrixTable({
  onOverrideChange,
  rows,
  values,
}: {
  onOverrideChange: (
    key: string,
    override: {
      priceAmount?: string | undefined;
      sku?: string | undefined;
      stockedQuantity?: string | undefined;
    },
  ) => void;
  rows: VariantMatrixRow[];
  values: ProductFormValues["variantOverrides"];
}) {
  const totalStock = rows.reduce((total, row) => total + row.stockedQuantity, 0);
  const prices = rows.map((row) => row.priceAmount);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceSummary = minPrice === maxPrice ? `ETB ${minPrice}` : `ETB ${minPrice} to ${maxPrice}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 md:grid-cols-3">
        <VariantMatrixMetric label="Variants" value={String(rows.length)} />
        <VariantMatrixMetric label="Total stocked" value={String(totalStock)} />
        <VariantMatrixMetric label="Price range" value={priceSummary} />
      </div>

      <div className="overflow-hidden rounded-2xl border bg-background shadow-sm shadow-primary/5">
        <div className="flex flex-col gap-1 border-b bg-muted/30 px-4 py-3">
          <h3 className="text-sm font-medium">Generated variant matrix</h3>
          <p className="text-sm text-muted-foreground">
            Review every sellable row. Change SKU, price, or stock only where needed.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[56rem] text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Variant</th>
              <th className="px-4 py-3 text-left font-medium">SKU</th>
              <th className="px-4 py-3 text-left font-medium">Price</th>
              <th className="px-4 py-3 text-left font-medium">Initial stock</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const override = values[row.key] ?? {};

              return (
                <tr className="border-t align-top" key={row.key}>
                  <td className="px-4 py-3">
                    <div className="mb-2 font-medium">
                      {Object.values(row.optionValues).join(" / ") || "Default variant"}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(row.optionValues).length ? (
                        Object.entries(row.optionValues).map(([title, value]) => (
                          <Badge className="rounded-md" key={`${title}:${value}`} variant="secondary">
                            {title}: {value}
                          </Badge>
                        ))
                      ) : (
                        <Badge className="rounded-md" variant="secondary">No options</Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Input
                      aria-label={`SKU for ${row.key}`}
                      className="h-9"
                      onChange={(event) =>
                        onOverrideChange(row.key, { sku: event.target.value })
                      }
                      value={override.sku ?? row.sku}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <InputGroup className="h-9">
                      <InputGroupAddon>ETB</InputGroupAddon>
                      <InputGroupInput
                        aria-label={`Price for ${row.key}`}
                        inputMode="numeric"
                        min="0"
                        onChange={(event) =>
                          onOverrideChange(row.key, { priceAmount: event.target.value })
                        }
                        type="text"
                        value={override.priceAmount ?? String(row.priceAmount)}
                      />
                    </InputGroup>
                  </td>
                  <td className="px-4 py-3">
                    <Input
                      aria-label={`Stock for ${row.key}`}
                      className="h-9"
                      inputMode="numeric"
                      min="0"
                      onChange={(event) =>
                        onOverrideChange(row.key, { stockedQuantity: event.target.value })
                      }
                      type="text"
                      value={override.stockedQuantity ?? String(row.stockedQuantity)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}

function VariantMatrixMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-background px-4 py-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 truncate text-sm font-medium">{value}</div>
    </div>
  );
}

function getProductDefaultValues(product: MerchantProduct | undefined): ProductFormValues {
  const firstPrice = getFirstVariantPrice(product);
  const title = product?.title ?? "";
  const generatedHandle = slugifyProductHandle(title);

  return {
    title,
    description: product?.description ?? "",
    handle: product?.handle ?? generatedHandle,
    thumbnail: product?.thumbnail ?? "",
    imageUrls: (product?.images ?? [])
      .map((image) => image.url)
      .filter(Boolean)
      .join("\n"),
    status: normalizeStatus(product?.status),
    priceAmount: firstPrice?.amount ?? "",
    currencyCode: "etb",
    initialStock: "0",
    options: getInitialProductOptions(product),
    skuPrefix: product?.handle?.toUpperCase() ?? "",
    variantOverrides: {},
    collectionId: product?.collectionId ?? NO_COLLECTION_VALUE,
    categoryIds: product?.categoryIds ?? [],
  };
}

function getProductPayload(values: ProductFormValues, options: { includeOptions: boolean }) {
  const parsed = productPayloadSchema.safeParse({
    title: values.title,
    description: getNullableString(values.description),
    handle: getNullableString(values.handle),
    thumbnail: getNullableString(values.thumbnail),
    imageUrls: values.imageUrls
      .split("\n")
      .map((row) => row.trim())
      .filter(Boolean),
    status: values.status,
    priceAmount: /^\d+$/.test(values.priceAmount.trim())
      ? Number.parseInt(values.priceAmount.trim(), 10)
      : undefined,
    currencyCode: values.currencyCode,
    options: options.includeOptions ? getProductOptionsPayload(values) : undefined,
    variants: options.includeOptions ? getProductVariantsPayload(values) : undefined,
    collectionId:
      values.collectionId && values.collectionId !== NO_COLLECTION_VALUE ? values.collectionId : null,
    categoryIds: values.categoryIds,
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Review the product fields and try again.");
  }

  return parsed.data;
}

function getProductSuccessPath(action: string, productId: string, isEdit: boolean) {
  const path = isEdit ? `/admin/products/${encodeURIComponent(productId)}` : "/admin/products";

  if (typeof window === "undefined") {
    return path;
  }

  const tenantId = new URL(action, window.location.origin).searchParams.get("tenantId");

  if (!tenantId) {
    return path;
  }

  const url = new URL(path, window.location.origin);

  url.searchParams.set("tenantId", tenantId);

  return `${url.pathname}${url.search}`;
}

function getFirstInvalidFieldForStep(
  step: ComposerStep["id"],
  values: ProductFormValues,
): keyof ProductFormValues | null {
  if (step === "details") {
    if (validateTitle(values.title)) {
      return "title";
    }

    if (validateImageUrls(values.imageUrls)) {
      return "imageUrls";
    }
  }

  if (step === "variants" && validatePriceAmount(values.priceAmount)) {
    return "priceAmount";
  }

  if (step === "variants" && validateInitialStock(values.initialStock)) {
    return "initialStock";
  }

  return null;
}

function getNullableString(value: string) {
  const trimmed = value.trim();

  return trimmed ? trimmed : null;
}

function validateTitle(value: string) {
  return value.trim() ? undefined : "Enter a product title.";
}

function validatePriceAmount(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "Enter a price.";
  }

  if (!/^\d+$/.test(trimmed)) {
    return /[a-zA-Z]/.test(trimmed)
      ? "Use numbers only."
      : "Use a whole number price without decimals or symbols.";
  }

  return undefined;
}

function getProductOptionsPayload(values: ProductFormValues) {
  const options = normalizeProductOptions(values.options);

  return options.length ? options : undefined;
}

function getProductVariantsPayload(values: ProductFormValues) {
  return getVariantRows(values).map((row) => ({
    optionValues: row.optionValues,
    sku: row.sku.trim() ? row.sku.trim() : null,
    priceAmount: row.priceAmount,
    currencyCode: row.currencyCode,
    stockedQuantity: row.stockedQuantity,
  }));
}

function getVariantRows(values: ProductFormValues) {
  return buildVariantMatrix({
    defaults: {
      currencyCode: values.currencyCode,
      priceAmount: parseWholeNumber(values.priceAmount) ?? 0,
      skuPrefix: values.skuPrefix,
      stockedQuantity: parseWholeNumber(values.initialStock) ?? 0,
    },
    options: normalizeProductOptions(values.options),
    overrides: getVariantOverrideMap(values.variantOverrides),
  });
}

function getVariantOverrideMap(values: ProductFormValues["variantOverrides"]) {
  return new Map(
    Object.entries(values).map(([key, override]) => [
      key,
      {
        ...(override.priceAmount?.trim()
          ? { priceAmount: parseWholeNumber(override.priceAmount) }
          : {}),
        ...(override.sku?.trim() ? { sku: override.sku.trim() } : {}),
        ...(override.stockedQuantity?.trim()
          ? { stockedQuantity: parseWholeNumber(override.stockedQuantity) }
          : {}),
      },
    ]),
  );
}

function normalizeProductOptions(options: ProductOptionDraft[]) {
  return options
    .map((option) => ({
      title: option.title.trim(),
      values: [...new Set(option.values.map((value) => value.trim()).filter(Boolean))],
    }))
    .filter((option) => option.title && option.values.length);
}

function validateInitialStock(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "Enter an initial stock quantity.";
  }

  if (!/^\d+$/.test(trimmed)) {
    return "Use a whole number stock quantity.";
  }

  return undefined;
}

function parseWholeNumber(value: string) {
  const trimmed = value.trim();

  return /^\d+$/.test(trimmed) ? Number.parseInt(trimmed, 10) : undefined;
}

class ProductMutationError extends Error {
  step: ComposerStep["id"] | null;

  constructor(message: string, step: ComposerStep["id"] | null = null) {
    super(message);
    this.name = "ProductMutationError";
    this.step = step;
  }
}

function getProductMutationError(error: string | undefined, status: number) {
  if (error === "product_conflict" || status === 409) {
    return new ProductMutationError(
      "A product with this handle may already exist. Change the handle and try again.",
      "details",
    );
  }

  if (error === "product_write_invalid" || status === 400 || status === 422) {
    return new ProductMutationError(
      "This product could not be saved. Review the highlighted fields and try again.",
      "details",
    );
  }

  if (error === "commerce_backend_unavailable") {
    return new ProductMutationError("Catalog changes are temporarily unavailable. Try again.");
  }

  if (error === "commerce_credentials_missing" || error === "commerce_credentials_invalid") {
    return new ProductMutationError("Catalog changes are temporarily unavailable. Contact support.");
  }

  return new ProductMutationError("Product could not be saved. Try again.");
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Product could not be saved. Try again.";
}

function validateImageUrls(value: string) {
  const urls = value
    .split("\n")
    .map((row) => row.trim())
    .filter(Boolean);

  for (const url of urls) {
    if (!z.string().url().safeParse(url).success) {
      return "Use full image URLs that start with http:// or https://.";
    }
  }

  return undefined;
}

function normalizeStatus(status: string | null | undefined): ProductFormValues["status"] {
  return status === "published" ? "published" : "draft";
}

function getFirstVariantPrice(product: MerchantProduct | undefined) {
  for (const variant of product?.variants ?? []) {
    for (const price of variant.prices) {
      if (price.amount !== null || price.currencyCode) {
        return {
          amount: price.amount === null ? "" : String(price.amount),
        };
      }
    }
  }

  return undefined;
}

function getInitialProductOptions(product: MerchantProduct | undefined): ProductOptionDraft[] {
  const options = new Map<string, Set<string>>();

  for (const variant of product?.variants ?? []) {
    for (const option of variant.optionValues ?? []) {
      if (!option.optionTitle || !option.value) {
        continue;
      }

      const values = options.get(option.optionTitle) ?? new Set<string>();
      values.add(option.value);
      options.set(option.optionTitle, values);
    }
  }

  return Array.from(options, ([title, values]) => ({
    title,
    values: Array.from(values),
  }));
}

function slugifyProductHandle(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function isInitialHandleLocked(product: MerchantProduct | undefined) {
  if (!product?.handle) {
    return true;
  }

  return product.handle === slugifyProductHandle(product.title ?? "");
}
