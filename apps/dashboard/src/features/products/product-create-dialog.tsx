"use client";

import { Suspense, useEffect, useState } from "react";

import { AppIcons } from "@/components/app/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ProductForm } from "@/features/products/product-form";
import { useProductTaxonomy } from "@/features/products/use-product-taxonomy";
import { useI18n } from "@/i18n/provider";
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

function ProductCreateDialogInner({ action, disabledReason, tenantId }: ProductCreateDialogProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [sessionKey, setSessionKey] = useState(0);
  const [offerTranslationAfterCreate, setOfferTranslationAfterCreate] = useState(false);
  // Load taxonomy only when the composer opens — not on every products page paint.
  const taxonomy = useProductTaxonomy({ enabled: open, tenantId });

  useEffect(() => {
    if (!open) return;
    const url = new URL("/dashboard/storefront/languages", window.location.origin);
    if (tenantId) url.searchParams.set("tenantId", tenantId);
    void fetch(url, { headers: { accept: "application/json" } })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as { enabledLocales?: unknown };
      })
      .then((payload) => {
        setOfferTranslationAfterCreate(
          Array.isArray(payload?.enabledLocales) && payload.enabledLocales.includes("am"),
        );
      })
      .catch(() => setOfferTranslationAfterCreate(false));
  }, [open, tenantId]);

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
        offerTranslationAfterCreate={offerTranslationAfterCreate}
        onClose={() => setOpen(false)}
        open={open}
        submitLabel={t("products.detail.createProduct")}
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
  const { t } = useI18n();
  return (
    <Button
      disabled={Boolean(disabledReason) || !onClick}
      onClick={onClick}
      title={disabledReason}
      type="button"
    >
      <AppIcons.products data-icon="inline-start" />
      {t("products.detail.createProduct")}
    </Button>
  );
}

function ReferenceDataLoadingAlert() {
  const { t } = useI18n();
  return (
    <Alert>
      <AlertTitle>{t("products.detail.loadingOptionsTitle")}</AlertTitle>
      <AlertDescription>{t("products.detail.loadingOptionsDesc")}</AlertDescription>
    </Alert>
  );
}

function ReferenceDataAlert({ labels }: { labels: string[] }) {
  const { t } = useI18n();
  return (
    <Alert variant="destructive">
      <AlertTitle>{t("products.detail.optionsLoadErrorTitle")}</AlertTitle>
      <AlertDescription>
        {t("products.create.optionsLoadErrorDesc", { labels: labels.join(` ${t("common.and")} `) })}
      </AlertDescription>
    </Alert>
  );
}
