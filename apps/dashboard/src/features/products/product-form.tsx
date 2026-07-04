"use client";

import type { MerchantProduct } from "@ecs/contracts";
import { useMemo, useState } from "react";

import { AppIcons } from "@/components/app/icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
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
import { Textarea } from "@/components/ui/textarea";

type ProductFormProps = {
  action: string;
  categories: Array<{ id: string; name: string | null; handle: string | null }>;
  collections: Array<{ id: string; title: string | null; handle: string | null }>;
  product?: MerchantProduct | undefined;
  submitLabel: string;
};

const NO_COLLECTION_VALUE = "__none";

export function ProductForm({
  action,
  categories,
  collections,
  product,
  submitLabel,
}: ProductFormProps) {
  const selectedCategoryIds = new Set(product?.categoryIds ?? []);
  const firstPrice = getFirstVariantPrice(product);
  const initialTitle = product?.title ?? "";
  const initialGeneratedHandle = slugifyProductHandle(initialTitle);
  const initialHandle = product?.handle ?? initialGeneratedHandle;
  const [title, setTitle] = useState(initialTitle);
  const [handle, setHandle] = useState(initialHandle);
  const [isHandleLocked, setIsHandleLocked] = useState(
    !product?.handle || product.handle === initialGeneratedHandle,
  );
  const [status, setStatus] = useState(normalizeStatus(product?.status));
  const [collectionId, setCollectionId] = useState(product?.collectionId ?? NO_COLLECTION_VALUE);
  const hasCollections = collections.length > 0;
  const HandleLockIcon = isHandleLocked ? AppIcons.lock : AppIcons.lockUnlock;
  const generatedHandle = useMemo(() => slugifyProductHandle(title), [title]);

  function updateTitle(nextTitle: string) {
    setTitle(nextTitle);

    if (isHandleLocked) {
      setHandle(slugifyProductHandle(nextTitle));
    }
  }

  function regenerateHandle() {
    setHandle(generatedHandle);
    setIsHandleLocked(true);
  }

  return (
    <form action={action} className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]" method="post">
      <Card>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="title">Title</FieldLabel>
              <Input
                id="title"
                name="title"
                onChange={(event) => updateTitle(event.target.value)}
                placeholder="Coffee beans"
                required
                value={title}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="handle">Handle</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id="handle"
                  name="handle"
                  onChange={(event) => setHandle(slugifyProductHandle(event.target.value))}
                  placeholder="coffee-beans"
                  readOnly={isHandleLocked}
                  value={handle}
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    aria-label={isHandleLocked ? "Unlock handle editing" : "Lock handle editing"}
                    onClick={() => setIsHandleLocked((current) => !current)}
                    title={isHandleLocked ? "Unlock handle editing" : "Lock handle editing"}
                  >
                    <HandleLockIcon data-icon="inline-start" />
                  </InputGroupButton>
                  <InputGroupButton
                    aria-label="Regenerate handle from title"
                    onClick={regenerateHandle}
                    title="Regenerate handle from title"
                  >
                    <AppIcons.refresh data-icon="inline-start" />
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
              <FieldDescription>
                {isHandleLocked
                  ? "The handle follows the title automatically."
                  : "Handle editing is unlocked for a custom storefront slug."}
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="description">Description</FieldLabel>
              <Textarea
                className="min-h-32"
                defaultValue={product?.description ?? ""}
                id="description"
                name="description"
                placeholder="Describe the product for the storefront."
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="thumbnail">Thumbnail URL</FieldLabel>
              <Input
                defaultValue={product?.thumbnail ?? ""}
                id="thumbnail"
                name="thumbnail"
                placeholder="https://cdn.example.com/product.jpg"
                type="url"
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="imageUrls">Image URLs</FieldLabel>
              <Textarea
                className="min-h-36"
                defaultValue={(product?.images ?? [])
                  .map((image) => image.url)
                  .filter(Boolean)
                  .join("\n")}
                id="imageUrls"
                name="imageUrls"
                placeholder={"https://cdn.example.com/front.jpg\nhttps://cdn.example.com/back.jpg"}
              />
              <FieldDescription>Enter one image URL per line.</FieldDescription>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-5">
        <Card>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="status">Status</FieldLabel>
                <input name="status" type="hidden" value={status} />
                <Select onValueChange={setStatus} value={status}>
                  <SelectTrigger className="w-full" id="status">
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

              <Field>
                <FieldLabel htmlFor="priceAmount">Price amount</FieldLabel>
                <Input
                  defaultValue={firstPrice?.amount ?? ""}
                  id="priceAmount"
                  min="0"
                  name="priceAmount"
                  placeholder="0"
                  step="1"
                  type="number"
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="currencyCode">Currency code</FieldLabel>
                <Input
                  id="currencyCode"
                  name="currencyCode"
                  readOnly
                  value="etb"
                />
                <FieldDescription>Catalog prices are fixed to ETB for this merchant market.</FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="collectionId">Collection</FieldLabel>
                <input
                  name="collectionId"
                  type="hidden"
                  value={collectionId === NO_COLLECTION_VALUE ? "" : collectionId}
                />
                <Select
                  disabled={!hasCollections}
                  onValueChange={setCollectionId}
                  value={collectionId}
                >
                  <SelectTrigger className="w-full" id="collectionId">
                    <SelectValue placeholder="Select collection" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value={NO_COLLECTION_VALUE}>No collection</SelectItem>
                      {collections.map((collection) => (
                        <SelectItem key={collection.id} value={collection.id}>
                          {getCollectionLabel(collection)}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <FieldSet>
              <FieldLegend variant="label">Categories</FieldLegend>
              <FieldDescription>Select all categories that apply.</FieldDescription>
              {categories.length ? (
                <FieldGroup data-slot="checkbox-group">
                  {categories.map((category) => {
                    const categoryInputId = `product-category-${category.id}`;

                    return (
                      <Field key={category.id} orientation="horizontal">
                        <Checkbox
                          defaultChecked={selectedCategoryIds.has(category.id)}
                          id={categoryInputId}
                          name="categoryIds"
                          value={category.id}
                        />
                        <FieldLabel className="font-normal" htmlFor={categoryInputId}>
                          {getCategoryLabel(category)}
                        </FieldLabel>
                      </Field>
                    );
                  })}
                </FieldGroup>
              ) : (
                <FieldDescription>No categories are available.</FieldDescription>
              )}
            </FieldSet>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit">{submitLabel}</Button>
        </div>
      </div>
    </form>
  );
}

function normalizeStatus(status: string | null | undefined) {
  return status === "published" ? "published" : "draft";
}

function getFirstVariantPrice(product: MerchantProduct | undefined) {
  for (const variant of product?.variants ?? []) {
    for (const price of variant.prices) {
      if (price.amount !== null || price.currencyCode) {
        return {
          amount: price.amount ?? "",
        };
      }
    }
  }

  return undefined;
}

function slugifyProductHandle(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function getCollectionLabel(collection: ProductFormProps["collections"][number]) {
  const label = collection.title ?? collection.handle ?? collection.id;

  return collection.handle && collection.handle !== label ? `${label} /${collection.handle}` : label;
}

function getCategoryLabel(category: ProductFormProps["categories"][number]) {
  const label = category.name ?? category.handle ?? category.id;

  return category.handle && category.handle !== label ? `${label} /${category.handle}` : label;
}
