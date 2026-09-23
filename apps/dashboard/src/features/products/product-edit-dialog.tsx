"use client";

import type {
  MerchantProduct,
  MerchantProductCategory,
  MerchantProductCollection,
  ProductOptionMediaBindings,
} from "@ecs/contracts";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useId, useMemo, useState } from "react";
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
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { MediaUploadField } from "@/features/media/media-upload-field";
import {
  CategoryPicker,
  CollectionPicker,
  NO_COLLECTION_VALUE,
} from "@/features/products/product-form-fields";
import { ProductOptionsWorkspace } from "@/features/products/product-form-sections";
import {
  applyOptionMediaAutoAssignment,
  getInitialProductOptions,
  getMediaUrls,
  getProductDefaultValues,
  getProductPayload,
  getRemovedExistingVariants,
  getVariantRows,
  reconcileOptionMediaBindings,
} from "@/features/products/product-form-state";
import type { ProductFormValues } from "@/features/products/product-form-types";
import { useProductHandleAvailability } from "@/features/products/use-product-handle-availability";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";

type ProductEditSheetBaseProps = {
  action: string;
  product: MerchantProduct;
};

type ProductDetailsValues = {
  description: string;
  handle: string;
  status: string;
  title: string;
};

type ProductOrganizationValues = {
  categoryIds: string[];
  collectionId: string;
};

type ProductMediaValues = {
  imageUrls: string;
  optionMediaBindings?: ProductOptionMediaBindings | null | undefined;
  thumbnail: string;
};

const PRODUCT_STATUS_OPTIONS = ["draft", "published"] as const;

export function ProductDetailsEditButton({
  action,
  product,
  triggerVariant = "button",
}: ProductEditSheetBaseProps & { triggerVariant?: "icon" | "button" }) {
  const { t } = useI18n();
  const detailsId = useId();
  const [values, setValues] = useState<ProductDetailsValues>(() => ({
    description: product.description ?? "",
    handle: product.handle ?? "",
    status: normalizeProductStatus(product.status),
    title: product.title ?? "",
  }));
  const [adjustedHandle, setAdjustedHandle] = useState<string | null>(null);
  const handleAvailability = useProductHandleAvailability({
    action,
    currentHandle: product.handle,
    handle: values.handle,
    productId: product.id,
  });
  useEffect(() => {
    if (handleAvailability.status !== "taken" || !handleAvailability.suggestedHandle) return;
    setValues((current) => ({
      ...current,
      handle: handleAvailability.suggestedHandle ?? current.handle,
    }));
    setAdjustedHandle(handleAvailability.suggestedHandle);
  }, [handleAvailability.status, handleAvailability.suggestedHandle]);

  return (
    <ProductEditSheet
      action={action}
      buildPayload={() => {
        const title = values.title.trim();

        if (!title) {
          throw new Error(t("products.edit.titleRequired"));
        }
        return {
          title,
          description: values.description.trim() || null,
          handle: values.handle.trim() || null,
          status: values.status,
        };
      }}
      description={t("products.edit.detailsDesc")}
      onOpen={() => {
        setAdjustedHandle(null);
        setValues({
          description: product.description ?? "",
          handle: product.handle ?? "",
          status: normalizeProductStatus(product.status),
          title: product.title ?? "",
        });
      }}
      title={t("products.edit.detailsTitle")}
      triggerLabel={t("products.edit.detailsTrigger")}
      triggerVariant={triggerVariant}
    >
      <Field>
        <FieldLabel htmlFor={`${detailsId}-title`}>{t("products.edit.title")}</FieldLabel>
        <Input
          id={`${detailsId}-title`}
          onChange={(event) => setValues((current) => ({ ...current, title: event.target.value }))}
          required
          value={values.title}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${detailsId}-handle`}>{t("products.edit.handle")}</FieldLabel>
        <Input
          id={`${detailsId}-handle`}
          onChange={(event) => {
            setAdjustedHandle(null);
            setValues((current) => ({ ...current, handle: event.target.value }));
          }}
          value={values.handle}
        />
        <FieldDescription>
          {adjustedHandle
            ? t("products.validation.handleAdjusted", { handle: adjustedHandle })
            : t("products.edit.handleHelp")}
        </FieldDescription>
      </Field>
      <Field>
        <FieldLabel>{t("products.edit.status")}</FieldLabel>
        <Select
          onValueChange={(value) => setValues((current) => ({ ...current, status: value }))}
          value={values.status}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={t("products.edit.selectStatus")} />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {PRODUCT_STATUS_OPTIONS.map((status) => (
                <SelectItem key={status} value={status}>
                  {status === "published"
                    ? t("products.filter.status.published")
                    : t("products.filter.status.draft")}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
      <Field>
        <FieldLabel htmlFor={`${detailsId}-description`}>
          {t("products.edit.description")}
        </FieldLabel>
        <RichTextEditor
          aria-label={t("products.edit.description")}
          id={`${detailsId}-description`}
          onChange={(description) => setValues((current) => ({ ...current, description }))}
          value={values.description}
        />
      </Field>
    </ProductEditSheet>
  );
}

export function ProductOrganizationEditButton({
  action,
  categories,
  collections,
  product,
}: ProductEditSheetBaseProps & {
  categories: MerchantProductCategory[];
  collections: MerchantProductCollection[];
}) {
  const { t } = useI18n();
  const [values, setValues] = useState<ProductOrganizationValues>(() => ({
    categoryIds: product.categoryIds ?? [],
    collectionId: product.collectionId ?? NO_COLLECTION_VALUE,
  }));
  const selectedCollection = collections.find(
    (collection) => collection.id === values.collectionId,
  );
  const selectedCategories = useMemo(
    () => categories.filter((category) => values.categoryIds.includes(category.id)),
    [categories, values.categoryIds],
  );

  return (
    <ProductEditSheet
      action={action}
      buildPayload={() => ({
        collectionId:
          values.collectionId && values.collectionId !== NO_COLLECTION_VALUE
            ? values.collectionId
            : null,
        categoryIds: values.categoryIds,
      })}
      description={t("products.edit.organizationDesc")}
      onOpen={() =>
        setValues({
          categoryIds: product.categoryIds ?? [],
          collectionId: product.collectionId ?? NO_COLLECTION_VALUE,
        })
      }
      title={t("products.edit.organizationTitle")}
      triggerLabel={t("products.edit.organizationTrigger")}
      triggerVariant="icon"
    >
      <Field>
        <FieldLabel>{t("products.filter.collection.label")}</FieldLabel>
        <CollectionPicker
          collections={collections}
          onChange={(collectionId) => setValues((current) => ({ ...current, collectionId }))}
          selectedCollection={selectedCollection}
          value={values.collectionId}
        />
      </Field>
      <Field>
        <FieldLabel>{t("products.filter.category.label")}</FieldLabel>
        <CategoryPicker
          categories={categories}
          onChange={(categoryIds) => setValues((current) => ({ ...current, categoryIds }))}
          selectedCategories={selectedCategories}
          value={values.categoryIds}
        />
      </Field>
    </ProductEditSheet>
  );
}

export function ProductMediaEditButton({
  defaultOpen = false,
  action,
  onClose,
  product,
  showTrigger = true,
  triggerLabel,
  triggerVariant = "button",
}: ProductEditSheetBaseProps & {
  defaultOpen?: boolean;
  onClose?: (() => void) | undefined;
  showTrigger?: boolean | undefined;
  triggerLabel?: string | undefined;
  triggerVariant?: "button" | "icon" | undefined;
}) {
  const { t } = useI18n();
  const [values, setValues] = useState<ProductMediaValues>(() => getProductMediaValues(product));
  const imageUrlList = getImageUrls(values.imageUrls);

  return (
    <ProductEditSheet
      action={action}
      buildPayload={() => buildProductMediaEditPayload(values)}
      defaultOpen={defaultOpen}
      hasUnsavedChanges={JSON.stringify(values) !== JSON.stringify(getProductMediaValues(product))}
      onClose={() => {
        if (defaultOpen) {
          const url = new URL(window.location.href);
          url.searchParams.delete("edit");
          window.history.replaceState(
            window.history.state,
            "",
            url.pathname + url.search + url.hash,
          );
        }
        onClose?.();
      }}
      contentClassName="sm:max-w-xl"
      description={t("products.edit.mediaDesc")}
      onOpen={() => setValues(getProductMediaValues(product))}
      title={t("products.edit.mediaTitle")}
      triggerLabel={triggerLabel ?? t("products.edit.mediaTrigger")}
      triggerVariant={triggerVariant}
      showTrigger={showTrigger}
    >
      <MediaUploadField
        imageUrls={imageUrlList}
        onImageUrlsChange={(urls) =>
          setValues((current) => ({
            ...current,
            imageUrls: urls.join("\n"),
            thumbnail:
              current.thumbnail && urls.includes(current.thumbnail)
                ? current.thumbnail
                : (urls[0] ?? ""),
          }))
        }
        onOptionMediaBindingsChange={(bindings) =>
          setValues((current) => ({ ...current, optionMediaBindings: bindings }))
        }
        onThumbnailChange={(url) => setValues((current) => ({ ...current, thumbnail: url }))}
        optionMediaBindings={values.optionMediaBindings}
        options={getInitialProductOptions(product)}
        thumbnail={values.thumbnail}
      />
    </ProductEditSheet>
  );
}

function getProductBulkValues(product: MerchantProduct) {
  const overrides = Object.values(getProductDefaultValues(product).variantOverrides).filter(
    (override) => override.enabled !== false,
  );
  const prices = new Set(overrides.map((override) => override.priceAmount).filter(Boolean));
  const stock = new Set(overrides.map((override) => override.stockedQuantity).filter(Boolean));

  return {
    priceAmount: prices.size === 1 ? ([...prices][0] ?? "") : "",
    stockedQuantity: stock.size === 1 ? ([...stock][0] ?? "") : "",
  };
}

export function ProductOptionsEditButton({ action, product }: ProductEditSheetBaseProps) {
  const { t } = useI18n();
  const router = useRouter();
  const [values, setValues] = useState<ProductFormValues>(() => ({
    ...getProductDefaultValues(product),
    hasVariants: true,
  }));
  const [bulkValues, setBulkValues] = useState(() => getProductBulkValues(product));
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const { leaveDialogOpen, requestLeave, confirmLeave, cancelLeave } = useUnsavedChangesGuard(
    dirty && open,
  );
  const removedVariants = getRemovedExistingVariants(values);

  function reset() {
    setValues({ ...getProductDefaultValues(product), hasVariants: true });
    setBulkValues(getProductBulkValues(product));
  }

  function update(next: Partial<ProductFormValues>) {
    setValues((current) => ({ ...current, ...next }));
    setDirty(true);
  }

  function requestClose() {
    requestLeave(() => setOpen(false));
  }

  async function submitEdit() {
    let payload: Record<string, unknown>;
    try {
      const productPayload = getProductPayload(values, { includeOptions: true }, t);
      payload = {
        options: productPayload.options,
        variants: productPayload.variants,
        optionMediaBindings: productPayload.optionMediaBindings ?? null,
      };
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t("products.edit.formError"));
      return;
    }

    setIsSaving(true);
    setError(null);
    const response = await fetch(action, {
      body: JSON.stringify(payload),
      headers: { accept: "application/json", "content-type": "application/json" },
      method: "POST",
    }).catch(() => null);
    const data = (await response?.json().catch(() => ({}))) as {
      error?: string;
      mediaSyncWarning?: boolean;
    };
    setIsSaving(false);
    if (!response?.ok) {
      setError(getProductEditErrorMessage(data.error, t));
      return;
    }
    toast[data.mediaSyncWarning ? "warning" : "success"](
      data.mediaSyncWarning ? t("products.composer.mediaSyncWarn") : t("products.edit.toastSaved"),
    );
    setDirty(false);
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button
        onClick={() => {
          reset();
          setError(null);
          setDirty(false);
          setOpen(true);
        }}
        size="sm"
        type="button"
        variant="ghost"
      >
        <AppIcons.edit data-icon="inline-start" />
        {t("products.edit.variantsTrigger")}
      </Button>
      <Dialog onOpenChange={(nextOpen) => (nextOpen ? setOpen(true) : requestClose())} open={open}>
        <DialogContent className="flex max-h-[min(92dvh,56rem)] max-w-[calc(100%-1rem)] flex-col gap-0 overflow-visible p-0 sm:max-w-5xl">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[inherit]">
            <DialogHeader className="border-b px-4 py-4 pr-12 sm:px-5">
              <DialogTitle>{t("products.edit.variantsTitle")}</DialogTitle>
              <DialogDescription>{t("products.edit.optionsDesc")}</DialogDescription>
            </DialogHeader>
            <form
              className="flex min-h-0 flex-1 flex-col"
              onSubmit={(event) => {
                event.preventDefault();
                void submitEdit();
              }}
            >
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5">
                <div className="grid gap-4">
                  {error ? (
                    <Alert variant="destructive">
                      <AlertTitle>{t("products.edit.toastError")}</AlertTitle>
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  ) : null}
                  <ProductOptionsWorkspace
                    stableHeight
                    bulkValues={bulkValues}
                    galleryImages={getMediaUrls(values.thumbnail, values.imageUrls)}
                    onApplyDefaults={(fields = { price: true, stock: true }) => {
                      update({
                        ...(fields.price ? { priceAmount: bulkValues.priceAmount } : {}),
                        ...(fields.stock ? { initialStock: bulkValues.stockedQuantity } : {}),
                        variantOverrides: Object.fromEntries(
                          getVariantRows(values).map((row) => [
                            row.key,
                            {
                              ...values.variantOverrides[row.key],
                              ...(fields.price ? { priceAmount: bulkValues.priceAmount } : {}),
                              ...(fields.stock
                                ? { stockedQuantity: bulkValues.stockedQuantity }
                                : {}),
                            },
                          ]),
                        ),
                      });
                    }}
                    onBulkValuesChange={(nextBulkValues) => {
                      setBulkValues(nextBulkValues);
                      setDirty(true);
                    }}
                    onGalleryImageAdd={(url) => {
                      const imageUrls = getImageUrls(values.imageUrls);
                      if (!imageUrls.includes(url)) imageUrls.push(url);
                      update({
                        imageUrls: imageUrls.join("\n"),
                        ...(!values.thumbnail.trim() ? { thumbnail: url } : {}),
                      });
                    }}
                    onOptionsChange={(options) => {
                      const bindings = reconcileOptionMediaBindings(
                        values.optionMediaBindings,
                        values.options,
                        options,
                      );
                      const nextValues = { ...values, options, optionMediaBindings: bindings };
                      update({
                        options,
                        optionMediaBindings: bindings,
                        variantOverrides: applyOptionMediaAutoAssignment({
                          variantOverrides: values.variantOverrides,
                          options,
                          rows: getVariantRows(nextValues),
                          optionMediaBindings: bindings,
                          validImageUrls: getMediaUrls(values.thumbnail, values.imageUrls),
                        }),
                      });
                    }}
                    onOverrideChange={(key, override) => {
                      const nextOverrides = {
                        ...values.variantOverrides,
                        [key]: { ...values.variantOverrides[key], ...override },
                      };
                      update({
                        variantOverrides:
                          "imageUrl" in override && !override.imageUrl
                            ? applyOptionMediaAutoAssignment({
                                variantOverrides: nextOverrides,
                                options: values.options,
                                rows: getVariantRows({
                                  ...values,
                                  variantOverrides: nextOverrides,
                                }),
                                optionMediaBindings: values.optionMediaBindings,
                                validImageUrls: getMediaUrls(values.thumbnail, values.imageUrls),
                              })
                            : nextOverrides,
                      });
                    }}
                    options={values.options}
                    rows={getVariantRows(values)}
                    values={values.variantOverrides}
                  />
                  {removedVariants.length ? (
                    <Alert>
                      <AlertTitle>{t("products.edit.variantRemovalTitle")}</AlertTitle>
                      <AlertDescription>
                        {t("products.edit.variantRemovalDesc", { count: removedVariants.length })}
                      </AlertDescription>
                    </Alert>
                  ) : null}
                </div>
              </div>
              <DialogFooter className="m-0 rounded-none px-4 py-3 sm:px-5">
                <Button disabled={isSaving} onClick={requestClose} type="button" variant="outline">
                  {t("common.cancel")}
                </Button>
                <Button disabled={isSaving} type="submit">
                  {isSaving ? t("products.edit.saving") : t("products.edit.saveChanges")}
                </Button>
              </DialogFooter>
            </form>
          </div>
        </DialogContent>
      </Dialog>
      <UnsavedChangesDialog onLeave={confirmLeave} onStay={cancelLeave} open={leaveDialogOpen} />
    </>
  );
}

function ProductEditSheet({
  action,
  buildPayload,
  showTrigger = true,
  children,
  contentClassName,
  defaultOpen = false,
  hasUnsavedChanges,
  onClose,
  description,
  onOpen,
  title,
  triggerLabel,
  triggerVariant = "icon",
}: {
  action: string;
  buildPayload: () => Record<string, unknown>;
  showTrigger?: boolean;
  children: ReactNode;
  contentClassName?: string;
  defaultOpen?: boolean;
  hasUnsavedChanges?: boolean;
  onClose?: () => void;
  description: string;
  onOpen: () => void;
  title: string;
  triggerLabel: string;
  /** icon = ghost pencil; button = labeled outline control */
  triggerVariant?: "icon" | "button";
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => {
    if (defaultOpen) setOpen(true);
  }, [defaultOpen]);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const { leaveDialogOpen, requestLeave, confirmLeave, cancelLeave } = useUnsavedChangesGuard(
    (hasUnsavedChanges ?? dirty) && open,
  );

  function closeSheet() {
    setOpen(false);
    onClose?.();
  }

  function openSheet() {
    onOpen();
    setError(null);
    setDirty(false);
    setOpen(true);
  }

  function requestClose() {
    if (!isSaving) requestLeave(closeSheet);
  }

  async function submitEdit() {
    let payload: Record<string, unknown>;

    try {
      payload = buildPayload();
    } catch (error) {
      setError(error instanceof Error ? error.message : t("products.edit.formError"));
      return;
    }

    setIsSaving(true);
    setError(null);

    const response = await fetch(action, {
      body: JSON.stringify(payload),
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      method: "POST",
    }).catch(() => null);
    const data = (await response?.json().catch(() => ({}))) as {
      error?: string;
      mediaSyncWarning?: boolean;
    };

    setIsSaving(false);

    if (!response?.ok) {
      setError(getProductEditErrorMessage(data.error, t));
      return;
    }

    toast[data.mediaSyncWarning ? "warning" : "success"](
      data.mediaSyncWarning ? t("products.composer.mediaSyncWarn") : t("products.edit.toastSaved"),
    );
    setDirty(false);
    closeSheet();
    router.refresh();
  }

  return (
    <>
      <Sheet
        onOpenChange={(nextOpen) => {
          if (nextOpen) {
            openSheet();
            return;
          }
          requestClose();
        }}
        open={open}
      >
        {showTrigger && triggerVariant === "button" ? (
          <Button onClick={openSheet} size="sm" type="button" variant="outline">
            <AppIcons.edit data-icon="inline-start" />
            {triggerLabel}
          </Button>
        ) : showTrigger ? (
          <Button
            aria-label={triggerLabel}
            onClick={openSheet}
            size="sm"
            type="button"
            variant="ghost"
          >
            <AppIcons.edit data-icon="inline-start" />
            <span className="text-xs font-medium">{t("common.edit")}</span>
          </Button>
        ) : null}
        <SheetContent className={cn("w-full sm:max-w-md", contentClassName)}>
          <SheetHeader>
            <SheetTitle>{title}</SheetTitle>
            <SheetDescription className="sr-only">{description}</SheetDescription>
          </SheetHeader>
          <form
            className="flex min-h-0 flex-1 flex-col"
            onChange={() => setDirty(true)}
            onSubmit={(event) => {
              event.preventDefault();
              void submitEdit();
            }}
          >
            <SheetBody className="flex flex-col gap-5">
              {error ? (
                <Alert variant="destructive">
                  <AlertTitle>{t("products.edit.toastError")}</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}
              <div className="grid gap-4">{children}</div>
            </SheetBody>
            <SheetFooter>
              <Button disabled={isSaving} type="button" variant="outline" onClick={requestClose}>
                {t("common.cancel")}
              </Button>
              <Button disabled={isSaving} type="submit">
                {isSaving ? t("products.edit.saving") : t("products.edit.saveChanges")}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
      <UnsavedChangesDialog onLeave={confirmLeave} onStay={cancelLeave} open={leaveDialogOpen} />
    </>
  );
}

function normalizeProductStatus(status: string | null) {
  return PRODUCT_STATUS_OPTIONS.find((option) => option === status?.toLowerCase()) ?? "draft";
}

export function buildProductMediaEditPayload(media: ProductMediaValues) {
  // Reconcile photos against current Medusa data, never the editor's price or stock snapshot.
  return {
    thumbnail: media.thumbnail.trim() || null,
    imageUrls: getImageUrls(media.imageUrls),
    optionMediaBindings: media.optionMediaBindings ?? null,
  };
}
function getProductMediaValues(product: MerchantProduct): ProductMediaValues {
  return {
    imageUrls: (product.images ?? [])
      .map((image) => image.url)
      .filter(Boolean)
      .join("\n"),
    optionMediaBindings: product.optionMediaBindings ?? null,
    thumbnail: product.thumbnail ?? "",
  };
}

function getImageUrls(value: string) {
  return value
    .split("\n")
    .map((row) => row.trim())
    .filter(Boolean);
}

function getProductEditErrorMessage(
  error: string | undefined,
  t: (key: import("@/i18n/messages").MessageKey) => string,
) {
  if (error === "product_conflict") {
    return t("products.editErrors.handleConflict");
  }

  if (error === "product_not_found") {
    return t("products.editErrors.notFound");
  }

  if (error === "commerce_backend_unavailable") {
    return t("products.editErrors.backendUnavailable");
  }

  return t("products.editErrors.saveFailed");
}
