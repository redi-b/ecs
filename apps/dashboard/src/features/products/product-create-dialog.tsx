"use client";

import type { MerchantProductCategory, MerchantProductCollection } from "@ecs/contracts";
import { useState } from "react";

import { AppIcons } from "@/components/app/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ProductForm } from "@/features/products/product-form";

type ProductCreateDialogProps = {
  action: string;
  categories: MerchantProductCategory[];
  collections: MerchantProductCollection[];
  disabledReason?: string | undefined;
  optionErrorLabels?: string[] | undefined;
};

export function ProductCreateDialog({
  action,
  categories,
  collections,
  disabledReason,
  optionErrorLabels = [],
}: ProductCreateDialogProps) {
  const [open, setOpen] = useState(false);
  const [sessionKey, setSessionKey] = useState(0);

  function openCreateDialog() {
    setSessionKey((current) => current + 1);
    setOpen(true);
  }

  return (
    <>
      <Button
        disabled={Boolean(disabledReason)}
        onClick={openCreateDialog}
        title={disabledReason}
        type="button"
      >
        <AppIcons.products data-icon="inline-start" />
        Create product
      </Button>
      <ProductForm
        action={action}
        categories={categories}
        collections={collections}
        key={sessionKey}
        notice={optionErrorLabels.length ? <ReferenceDataAlert labels={optionErrorLabels} /> : null}
        onClose={() => setOpen(false)}
        open={open}
        submitLabel="Create product"
      />
    </>
  );
}

function ReferenceDataAlert({ labels }: { labels: string[] }) {
  return (
    <Alert variant="destructive">
      <AlertTitle>Product options could not be loaded</AlertTitle>
      <AlertDescription>
        {`Could not load ${labels.join(" and ")}. You can still create a basic product and add options later.`}
      </AlertDescription>
    </Alert>
  );
}
