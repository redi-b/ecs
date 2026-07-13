"use client";

import type {
  MerchantProduct,
  MerchantProductCategory,
  MerchantProductCollection,
} from "@ecs/contracts";
import { useRouter } from "next/navigation";
import { type ReactNode, useId, useMemo, useState } from "react";
import { toast } from "sonner";

import { AppIcons } from "@/components/app/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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
import { Textarea } from "@/components/ui/textarea";
import { MediaUploadField } from "@/features/media/media-upload-field";
import {
  CategoryPicker,
  CollectionPicker,
  NO_COLLECTION_VALUE,
} from "@/features/products/product-form-fields";
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
  thumbnail: string;
};

const PRODUCT_STATUS_OPTIONS = ["draft", "published"] as const;

export function ProductDetailsEditButton({ action, product }: ProductEditSheetBaseProps) {
  const detailsId = useId();
  const [values, setValues] = useState<ProductDetailsValues>(() => ({
    description: product.description ?? "",
    handle: product.handle ?? "",
    status: normalizeProductStatus(product.status),
    title: product.title ?? "",
  }));

  return (
    <ProductEditSheet
      action={action}
      buildPayload={() => {
        const title = values.title.trim();

        if (!title) {
          throw new Error("Product title is required.");
        }

        return {
          title,
          description: values.description.trim() || null,
          handle: values.handle.trim() || null,
          status: values.status,
        };
      }}
      description="Update the core product information shown to shoppers."
      onOpen={() =>
        setValues({
          description: product.description ?? "",
          handle: product.handle ?? "",
          status: normalizeProductStatus(product.status),
          title: product.title ?? "",
        })
      }
      title="Edit product details"
      triggerLabel="Edit product details"
    >
      <Field>
        <FieldLabel htmlFor={`${detailsId}-title`}>Title</FieldLabel>
        <Input
          id={`${detailsId}-title`}
          onChange={(event) => setValues((current) => ({ ...current, title: event.target.value }))}
          required
          value={values.title}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${detailsId}-handle`}>Handle</FieldLabel>
        <Input
          id={`${detailsId}-handle`}
          onChange={(event) => setValues((current) => ({ ...current, handle: event.target.value }))}
          value={values.handle}
        />
        <FieldDescription>Leave empty to generate a handle automatically.</FieldDescription>
      </Field>
      <Field>
        <FieldLabel>Status</FieldLabel>
        <Select
          onValueChange={(value) => setValues((current) => ({ ...current, status: value }))}
          value={values.status}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select status" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {PRODUCT_STATUS_OPTIONS.map((status) => (
                <SelectItem key={status} value={status}>
                  {status === "published" ? "Published" : "Draft"}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
      <Field>
        <FieldLabel htmlFor={`${detailsId}-description`}>Description</FieldLabel>
        <Textarea
          id={`${detailsId}-description`}
          onChange={(event) =>
            setValues((current) => ({ ...current, description: event.target.value }))
          }
          rows={6}
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
      description="Update how this product is grouped in the catalog."
      onOpen={() =>
        setValues({
          categoryIds: product.categoryIds ?? [],
          collectionId: product.collectionId ?? NO_COLLECTION_VALUE,
        })
      }
      title="Edit organization"
      triggerLabel="Edit product organization"
    >
      <Field>
        <FieldLabel>Collection</FieldLabel>
        <CollectionPicker
          collections={collections}
          onChange={(collectionId) => setValues((current) => ({ ...current, collectionId }))}
          selectedCollection={selectedCollection}
          value={values.collectionId}
        />
      </Field>
      <Field>
        <FieldLabel>Categories</FieldLabel>
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

export function ProductMediaEditButton({ action, product }: ProductEditSheetBaseProps) {
  const [values, setValues] = useState<ProductMediaValues>(() => getProductMediaValues(product));
  const imageUrlList = getImageUrls(values.imageUrls);

  return (
    <ProductEditSheet
      action={action}
      buildPayload={() => ({
        thumbnail: values.thumbnail.trim() || null,
        imageUrls: getImageUrls(values.imageUrls),
      })}
      contentClassName="sm:max-w-xl"
      description="Upload images, pick from your library, set a cover, and reorder the gallery."
      onOpen={() => setValues(getProductMediaValues(product))}
      title="Edit product media"
      triggerLabel="Edit product media"
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
        onThumbnailChange={(url) => setValues((current) => ({ ...current, thumbnail: url }))}
        thumbnail={values.thumbnail}
      />
    </ProductEditSheet>
  );
}

function ProductEditSheet({
  action,
  buildPayload,
  children,
  contentClassName,
  description,
  onOpen,
  title,
  triggerLabel,
}: {
  action: string;
  buildPayload: () => Record<string, unknown>;
  children: ReactNode;
  contentClassName?: string;
  description: string;
  onOpen: () => void;
  title: string;
  triggerLabel: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function submitEdit() {
    let payload: Record<string, unknown>;

    try {
      payload = buildPayload();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Check the form and try again.");
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
    const data = (await response?.json().catch(() => ({}))) as { error?: string };

    setIsSaving(false);

    if (!response?.ok) {
      setError(getProductEditErrorMessage(data.error));
      return;
    }

    toast.success("Product updated.");
    setOpen(false);
    router.refresh();
  }

  return (
    <Sheet
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          onOpen();
          setError(null);
        }

        setOpen(nextOpen);
      }}
      open={open}
    >
      <Button
        aria-label={triggerLabel}
        onClick={() => setOpen(true)}
        size="icon-sm"
        type="button"
        variant="ghost"
      >
        <AppIcons.edit data-icon="inline-start" />
      </Button>
      <SheetContent className={cn("w-full sm:max-w-md", contentClassName)}>
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            void submitEdit();
          }}
        >
          <SheetBody className="flex flex-col gap-5">
            {error ? (
              <Alert variant="destructive">
                <AlertTitle>Product could not be updated</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <div className="grid gap-4">{children}</div>
          </SheetBody>
          <SheetFooter>
            <Button disabled={isSaving} type="submit">
              {isSaving ? "Saving..." : "Save changes"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function normalizeProductStatus(status: string | null) {
  return PRODUCT_STATUS_OPTIONS.find((option) => option === status?.toLowerCase()) ?? "draft";
}

function getProductMediaValues(product: MerchantProduct): ProductMediaValues {
  return {
    imageUrls: (product.images ?? [])
      .map((image) => image.url)
      .filter(Boolean)
      .join("\n"),
    thumbnail: product.thumbnail ?? "",
  };
}

function getImageUrls(value: string) {
  return value
    .split("\n")
    .map((row) => row.trim())
    .filter(Boolean);
}

function getProductEditErrorMessage(error: string | undefined) {
  if (error === "product_conflict") {
    return "Another product already uses that handle.";
  }

  if (error === "product_not_found") {
    return "This product is no longer available.";
  }

  if (error === "commerce_backend_unavailable") {
    return "The commerce backend is temporarily unavailable.";
  }

  return "Product details could not be saved. Try again.";
}
