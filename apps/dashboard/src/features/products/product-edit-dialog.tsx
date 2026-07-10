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
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
  CategoryPicker,
  CollectionPicker,
  NO_COLLECTION_VALUE,
} from "@/features/products/product-form-fields";

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
  const mediaId = useId();
  const [values, setValues] = useState<ProductMediaValues>(() => getProductMediaValues(product));

  return (
    <ProductEditSheet
      action={action}
      buildPayload={() => ({
        thumbnail: values.thumbnail.trim() || null,
        imageUrls: getImageUrls(values.imageUrls),
      })}
      description="Update the thumbnail and gallery image URLs."
      onOpen={() => setValues(getProductMediaValues(product))}
      title="Edit product media"
      triggerLabel="Edit product media"
    >
      <Field>
        <FieldLabel htmlFor={`${mediaId}-thumbnail`}>Thumbnail URL</FieldLabel>
        <Input
          id={`${mediaId}-thumbnail`}
          onChange={(event) =>
            setValues((current) => ({ ...current, thumbnail: event.target.value }))
          }
          value={values.thumbnail}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${mediaId}-images`}>Image URLs</FieldLabel>
        <Textarea
          id={`${mediaId}-images`}
          onChange={(event) =>
            setValues((current) => ({ ...current, imageUrls: event.target.value }))
          }
          rows={8}
          value={values.imageUrls}
        />
        <FieldDescription>One URL per line.</FieldDescription>
      </Field>
    </ProductEditSheet>
  );
}

function ProductEditSheet({
  action,
  buildPayload,
  children,
  description,
  onOpen,
  title,
  triggerLabel,
}: {
  action: string;
  buildPayload: () => Record<string, unknown>;
  children: ReactNode;
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
      <SheetContent
        className="w-full overflow-y-auto sm:max-w-md"
        onInteractOutside={(event) => {
          const target = event.target;

          if (!(target instanceof HTMLElement)) {
            return;
          }

          if (target.closest("[data-slot='select-content'], [data-radix-popper-content-wrapper]")) {
            event.preventDefault();
          }
        }}
      >
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <form
          className="flex flex-1 flex-col gap-5 px-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submitEdit();
          }}
        >
          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Product could not be updated</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <div className="grid gap-4">{children}</div>
          <SheetFooter className="px-0">
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
