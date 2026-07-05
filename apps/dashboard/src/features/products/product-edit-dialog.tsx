"use client";

import type {
  MerchantProduct,
  MerchantProductCategory,
  MerchantProductCollection,
} from "@ecs/contracts";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ProductForm } from "@/features/products/product-form";

type ProductEditDialogProps = {
  action: string;
  categories: MerchantProductCategory[];
  collections: MerchantProductCollection[];
  product: MerchantProduct;
  returnHref: string;
};

export function ProductEditDialog({
  action,
  categories,
  collections,
  product,
  returnHref,
}: ProductEditDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)} type="button">
        Edit product
      </Button>
      <ProductForm
        action={action}
        categories={categories}
        collections={collections}
        onClose={() => setOpen(false)}
        open={open}
        product={product}
        returnHref={returnHref}
        submitLabel="Save product"
      />
    </>
  );
}
