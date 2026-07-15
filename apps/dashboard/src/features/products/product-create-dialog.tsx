"use client";

import { Suspense, useState } from "react";

import { AppIcons } from "@/components/app/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ProductForm } from "@/features/products/product-form";
import { useProductTaxonomy } from "@/features/products/use-product-taxonomy";
import { useCreateQueryOpen } from "@/lib/use-create-query-open";

type ProductCreateDialogProps = {
  action: string;
  disabledReason?: string | undefined;
  tenantId?: string | undefined;
};

export function ProductCreateDialog(props: ProductCreateDialogProps) {
  return (
    <Suspense fallback={<CreateProductTrigger disabledReason={props.disabledReason} />}>
      <ProductCreateDialogInner {...props} />
    </Suspense>
  );
}

function ProductCreateDialogInner({
  action,
  disabledReason,
  tenantId,
}: ProductCreateDialogProps) {
  const [open, setOpen] = useState(false);
  const [sessionKey, setSessionKey] = useState(0);
  // Load taxonomy only when the composer opens — not on every products page paint.
  const taxonomy = useProductTaxonomy({ enabled: open, tenantId });

  function openCreateDialog() {
    setSessionKey((current) => current + 1);
    setOpen(true);
  }

  useCreateQueryOpen({
    values: ["1", "true", "product"],
    onOpen: openCreateDialog,
  });

  return (
    <>
      <CreateProductTrigger disabledReason={disabledReason} onClick={openCreateDialog} />
      <ProductForm
        action={action}
        categories={taxonomy.categories}
        collections={taxonomy.collections}
        key={sessionKey}
        notice={
          taxonomy.errorLabels.length ? (
            <ReferenceDataAlert labels={taxonomy.errorLabels} />
          ) : taxonomy.isPending ? (
            <ReferenceDataLoadingAlert />
          ) : null
        }
        onClose={() => setOpen(false)}
        open={open}
        submitLabel="Create product"
      />
    </>
  );
}

function CreateProductTrigger({
  disabledReason,
  onClick,
}: {
  disabledReason?: string | undefined;
  onClick?: () => void;
}) {
  return (
    <Button
      disabled={Boolean(disabledReason) || !onClick}
      onClick={onClick}
      title={disabledReason}
      type="button"
    >
      <AppIcons.products data-icon="inline-start" />
      Create product
    </Button>
  );
}

function ReferenceDataLoadingAlert() {
  return (
    <Alert>
      <AlertTitle>Loading product options</AlertTitle>
      <AlertDescription>
        Categories and collections are loading. You can still enter product details.
      </AlertDescription>
    </Alert>
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
