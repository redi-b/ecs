import type { MerchantProduct } from "@ecs/contracts";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type ProductFormProps = {
  action: string;
  categories: Array<{ id: string; name: string; handle: string | null }>;
  collections: Array<{ id: string; title: string; handle: string | null }>;
  product?: MerchantProduct | undefined;
  submitLabel: string;
};

const nativeControlClassName =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm";

export function ProductForm({
  action,
  categories,
  collections,
  product,
  submitLabel,
}: ProductFormProps) {
  const selectedCategoryIds = new Set(product?.categoryIds ?? []);
  const firstPrice = getFirstVariantPrice(product);

  return (
    <form action={action} className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]" method="post">
      <div className="rounded-lg border bg-background p-5">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="title">Title</FieldLabel>
            <Input
              defaultValue={product?.title ?? ""}
              id="title"
              name="title"
              placeholder="Coffee beans"
              required
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="handle">Handle</FieldLabel>
            <Input
              defaultValue={product?.handle ?? ""}
              id="handle"
              name="handle"
              placeholder="coffee-beans"
            />
            <FieldDescription>Used as the product URL slug when provided.</FieldDescription>
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
      </div>

      <div className="flex flex-col gap-5">
        <div className="rounded-lg border bg-background p-5">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="status">Status</FieldLabel>
              <select
                className={nativeControlClassName}
                defaultValue={normalizeStatus(product?.status)}
                id="status"
                name="status"
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
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
                defaultValue={firstPrice?.currencyCode ?? "etb"}
                id="currencyCode"
                name="currencyCode"
                placeholder="etb"
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="collectionId">Collection</FieldLabel>
              <select
                className={nativeControlClassName}
                defaultValue={product?.collectionId ?? ""}
                id="collectionId"
                name="collectionId"
              >
                <option value="">No collection</option>
                {collections.map((collection) => (
                  <option key={collection.id} value={collection.id}>
                    {getCollectionLabel(collection)}
                  </option>
                ))}
              </select>
            </Field>
          </FieldGroup>
        </div>

        <div className="rounded-lg border bg-background p-5">
          <FieldSet>
            <FieldLegend variant="label">Categories</FieldLegend>
            <FieldDescription>Select all categories that apply.</FieldDescription>
            {categories.length ? (
              <FieldGroup data-slot="checkbox-group">
                {categories.map((category) => {
                  const categoryInputId = `product-category-${category.id}`;

                  return (
                    <Field key={category.id} orientation="horizontal">
                      <input
                        className={cn(
                          "size-4 shrink-0 rounded border border-input bg-transparent text-primary outline-none transition-colors",
                          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                        )}
                        defaultChecked={selectedCategoryIds.has(category.id)}
                        id={categoryInputId}
                        name="categoryIds"
                        type="checkbox"
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
        </div>

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
          currencyCode: price.currencyCode ?? "etb",
        };
      }
    }
  }

  return undefined;
}

function getCollectionLabel(collection: ProductFormProps["collections"][number]) {
  return collection.handle ? `${collection.title} /${collection.handle}` : collection.title;
}

function getCategoryLabel(category: ProductFormProps["categories"][number]) {
  return category.handle ? `${category.name} /${category.handle}` : category.name;
}
