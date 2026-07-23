"use client";

import type { MerchantProduct, MerchantProductStock } from "@ecs/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState } from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/app/data-table";
import { DetailMetric, DetailSection } from "@/components/app/detail-surface";
import { AppIcons } from "@/components/app/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/provider";
import { getTenantScopedPath } from "@/lib/dashboard-tenant-context";
import { dashboardRoutes } from "@/lib/routes";

type Translate = (key: MessageKey, values?: Record<string, string | number | Date>) => string;

type ProductStockPanelProps = {
  action: string;
  initialStock?: MerchantProductStock | undefined;
  product: MerchantProduct;
  productId: string;
  stockError?: string | undefined;
  tenantId?: string | undefined;
};

type VariantInventoryRow = {
  error: string | undefined;
  isLoading: boolean;
  isSaving: boolean;
  onStockedQuantityChange: (value: string) => void;
  onSubmit: () => void;
  stock: MerchantProductStock | undefined;
  stockedQuantity: string;
  variant: NonNullable<MerchantProduct["variants"]>[number];
};

export function SingleVariantStockPanel({
  action,
  initialStock,
  productId,
  stockError,
}: {
  action: string;
  initialStock?: MerchantProductStock | undefined;
  productId: string;
  stockError?: string | undefined;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const queryClient = useQueryClient();
  const stockedQuantityInputId = useId();
  const [stock, setStock] = useState(initialStock);
  const [stockedQuantity, setStockedQuantity] = useState(
    initialStock?.stockedQuantity === null || initialStock?.stockedQuantity === undefined
      ? ""
      : String(initialStock.stockedQuantity),
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: async () => {
      const parsedQuantity = Number.parseInt(stockedQuantity, 10);

      if (!Number.isInteger(parsedQuantity) || parsedQuantity < 0) {
        throw new Error(t("products.stock.enterWholeNumber"));
      }

      const response = await fetch(action, {
        body: JSON.stringify({
          stockedQuantity: parsedQuantity,
        }),
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        method: "POST",
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        stock?: MerchantProductStock;
      };

      if (!response.ok || !data.stock) {
        throw new Error(getStockErrorMessage(data.error, t));
      }

      return data.stock;
    },
    onSuccess: async (nextStock) => {
      setStock(nextStock);
      setActionError(null);
      await queryClient.invalidateQueries({ queryKey: ["product", productId] });
      toast.success(t("products.stock.toastUpdated"));
      router.refresh();
    },
    onError: (error) => {
      const message =
        error instanceof Error ? error.message : t("products.stock.couldNotUpdate");

      setActionError(message);
    },
  });

  if (!stock) {
    return (
      <DetailSection title={t("products.stock.title")}>
        <p className="text-sm text-muted-foreground">{t("products.stock.trackDescription")}</p>
        <StockAlert error={stockError} />
      </DetailSection>
    );
  }

  return (
    <DetailSection
      meta={<StockStateBadge availableQuantity={getAvailableQuantity(stock)} />}
      title={t("products.stock.title")}
    >
      <p className="-mt-1 text-sm text-muted-foreground">{t("products.stock.locationDescription")}</p>
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <DetailMetric
          label={t("products.stock.available")}
          value={formatQuantity(stock.availableQuantity, t)}
        />
        <DetailMetric
          label={t("products.stock.stocked")}
          value={formatQuantity(stock.stockedQuantity, t)}
        />
        <DetailMetric
          label={t("products.stock.reserved")}
          value={formatQuantity(stock.reservedQuantity, t)}
        />
        <DetailMetric
          label={t("products.stock.incoming")}
          value={formatQuantity(stock.incomingQuantity, t)}
        />
      </div>

      <form
        className="rounded-xl bg-muted/25 p-4 ring-1 ring-foreground/[0.06]"
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate();
        }}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <Field className="max-w-xs flex-1">
            <FieldLabel htmlFor={stockedQuantityInputId}>
              {t("products.stock.setStockedQuantity")}
            </FieldLabel>
            <Input
              id={stockedQuantityInputId}
              min="0"
              onChange={(event) => setStockedQuantity(event.target.value)}
              step="1"
              type="number"
              value={stockedQuantity}
            />
            <FieldDescription>{t("products.stock.reservedHelp")}</FieldDescription>
          </Field>
          <Button disabled={mutation.isPending} type="submit">
            {mutation.isPending ? t("products.stock.saving") : t("products.stock.saveStock")}
          </Button>
        </div>
      </form>

      {actionError ? (
        <Alert variant="destructive">
          <AlertTitle>{t("products.stock.updateFailedTitle")}</AlertTitle>
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      ) : null}
    </DetailSection>
  );
}

export function VariantStockPanel({
  productId,
  tenantId,
  variants,
}: {
  productId: string;
  tenantId?: string | undefined;
  variants: NonNullable<MerchantProduct["variants"]>;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [stockByVariantId, setStockByVariantId] = useState<Record<string, MerchantProductStock>>(
    {},
  );
  const [stockedQuantityByVariantId, setStockedQuantityByVariantId] = useState<
    Record<string, string>
  >({});
  const [errorByVariantId, setErrorByVariantId] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const stocks = Object.values(stockByVariantId);
  const totalAvailable = stocks.reduce(
    (total, stock) => total + (stock.availableQuantity ?? stock.stockedQuantity ?? 0),
    0,
  );
  const totalReserved = stocks.reduce((total, stock) => total + (stock.reservedQuantity ?? 0), 0);
  const totalStocked = stocks.reduce((total, stock) => total + (stock.stockedQuantity ?? 0), 0);
  const [query, setQuery] = useState("");
  const filteredVariants = useMemo(() => {
    const needle = query.trim().toLowerCase();

    if (!needle) {
      return variants;
    }

    return variants.filter((variant) =>
      [
        variant.id,
        variant.title,
        variant.sku,
        formatVariantPrice(variant, t),
        ...(variant.optionValues ?? []).flatMap((option) => [option.optionTitle, option.value]),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)),
    );
  }, [query, t, variants]);
  const columns = useMemo(() => getVariantInventoryColumns(t), [t]);

  useEffect(() => {
    let cancelled = false;

    async function loadVariantStock() {
      setIsLoading(true);
      const results = await Promise.all(
        variants.map(async (variant) => {
          const response = await fetch(getVariantStockAction(productId, variant.id, tenantId), {
            headers: {
              accept: "application/json",
            },
          }).catch(() => null);
          const data = (await response?.json().catch(() => ({}))) as {
            error?: string;
            stock?: MerchantProductStock;
          };

          return {
            error: response?.ok && data.stock ? null : getStockErrorMessage(data.error, t),
            stock: data.stock,
            variantId: variant.id,
          };
        }),
      );

      if (cancelled) {
        return;
      }

      setStockByVariantId(
        Object.fromEntries(
          results.flatMap((result) => (result.stock ? [[result.variantId, result.stock]] : [])),
        ),
      );
      setStockedQuantityByVariantId(
        Object.fromEntries(
          results.flatMap((result) =>
            result.stock?.stockedQuantity === null || result.stock?.stockedQuantity === undefined
              ? []
              : [[result.variantId, String(result.stock.stockedQuantity)]],
          ),
        ),
      );
      setErrorByVariantId(
        Object.fromEntries(
          results.flatMap((result) => (result.error ? [[result.variantId, result.error]] : [])),
        ),
      );
      setIsLoading(false);
    }

    void loadVariantStock();

    return () => {
      cancelled = true;
    };
  }, [productId, t, tenantId, variants]);

  const mutation = useMutation({
    mutationFn: async (variantId: string) => {
      const rawQuantity = stockedQuantityByVariantId[variantId] ?? "";
      const parsedQuantity = Number.parseInt(rawQuantity, 10);

      if (!Number.isInteger(parsedQuantity) || parsedQuantity < 0) {
        throw new Error(t("products.stock.enterWholeNumber"));
      }

      const response = await fetch(getVariantStockAction(productId, variantId, tenantId), {
        body: JSON.stringify({
          stockedQuantity: parsedQuantity,
        }),
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        method: "POST",
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        stock?: MerchantProductStock;
      };

      if (!response.ok || !data.stock) {
        throw new Error(getStockErrorMessage(data.error, t));
      }

      return data.stock;
    },
    onSuccess: async (nextStock) => {
      setStockByVariantId((current) => ({
        ...current,
        [nextStock.variantId]: nextStock,
      }));
      setStockedQuantityByVariantId((current) => ({
        ...current,
        [nextStock.variantId]:
          nextStock.stockedQuantity === null || nextStock.stockedQuantity === undefined
            ? ""
            : String(nextStock.stockedQuantity),
      }));
      setErrorByVariantId((current) => {
        const { [nextStock.variantId]: _removed, ...rest } = current;

        return rest;
      });
      await queryClient.invalidateQueries({ queryKey: ["product", productId] });
      toast.success(t("products.stock.toastVariantUpdated"));
      router.refresh();
    },
    onError: (error, variantId) => {
      const message =
        error instanceof Error ? error.message : t("products.stock.couldNotUpdate");

      setErrorByVariantId((current) => ({
        ...current,
        [variantId]: message,
      }));
    },
  });
  const rows = useMemo<VariantInventoryRow[]>(
    () =>
      filteredVariants.map((variant) => ({
        error: errorByVariantId[variant.id],
        isLoading,
        isSaving: mutation.isPending && mutation.variables === variant.id,
        onStockedQuantityChange: (value) =>
          setStockedQuantityByVariantId((current) => ({
            ...current,
            [variant.id]: value,
          })),
        onSubmit: () => mutation.mutate(variant.id),
        stock: stockByVariantId[variant.id],
        stockedQuantity: stockedQuantityByVariantId[variant.id] ?? "",
        variant,
      })),
    [
      errorByVariantId,
      filteredVariants,
      isLoading,
      mutation,
      stockByVariantId,
      stockedQuantityByVariantId,
    ],
  );

  return (
    <DetailSection
      meta={
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary">
            {t("products.stock.variantsCount", { count: variants.length })}
          </Badge>
          <StockStateBadge availableQuantity={totalAvailable} />
        </div>
      }
      title={t("products.stock.variantTitle")}
    >
      <p className="-mt-1 text-sm text-muted-foreground">{t("products.stock.variantDescription")}</p>
      <div className="grid gap-2.5 sm:grid-cols-3">
        <DetailMetric
          label={t("products.stock.available")}
          value={isLoading ? t("products.stock.loading") : String(totalAvailable)}
        />
        <DetailMetric
          label={t("products.stock.stocked")}
          value={isLoading ? t("products.stock.loading") : String(totalStocked)}
        />
        <DetailMetric
          label={t("products.stock.reserved")}
          value={isLoading ? t("products.stock.loading") : String(totalReserved)}
        />
      </div>

      <DataTable
        columns={columns}
        data={rows}
        emptyMessage={t("products.stock.emptyMatchMessage")}
        emptyTitle={t("products.stock.emptyMatchTitle")}
        getRowId={(row) => row.variant.id}
        isFiltered={Boolean(query.trim())}
        pageSize={8}
        toolbar={
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-sm font-medium">{t("products.stock.inventoryHeading")}</h3>
              <p className="text-sm text-muted-foreground">{t("products.stock.inventoryHelp")}</p>
            </div>
            <div className="relative md:w-72">
              <AppIcons.search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                data-icon="inline-start"
              />
              <Input
                aria-label={t("products.stock.searchAria")}
                className="h-9 pl-9"
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("products.stock.searchPlaceholder")}
                value={query}
              />
            </div>
          </div>
        }
      />
    </DetailSection>
  );
}

export function getVariantInventoryColumns(t: Translate): ColumnDef<VariantInventoryRow>[] {
  return [
    {
      id: "variant",
      accessorFn: (row) => row.variant.title ?? row.variant.id,
      header: t("products.stock.colVariant"),
      cell: ({ row }) => {
        const { error, variant } = row.original;

        return (
          <div className="min-w-[12rem] max-w-[18rem] whitespace-normal">
            <div className="font-medium">
              {variant.title ?? t("products.stock.untitledVariant")}
            </div>
            <VariantOptionSummary variant={variant} />
            {error ? <div className="mt-2 text-xs text-destructive">{error}</div> : null}
          </div>
        );
      },
    },
    {
      id: "sku",
      accessorFn: (row) => row.variant.sku ?? "",
      header: t("products.stock.colSku"),
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">
          {row.original.variant.sku ?? t("products.stock.noSku")}
        </span>
      ),
    },
    {
      id: "price",
      accessorFn: (row) => formatVariantPrice(row.variant, t),
      header: t("products.stock.colPrice"),
      cell: ({ row }) => (
        <span className="tabular-nums">{formatVariantPrice(row.original.variant, t)}</span>
      ),
    },
    {
      id: "available",
      accessorFn: (row) => row.stock?.availableQuantity ?? row.stock?.stockedQuantity ?? 0,
      // Keep header/cell alignment: both start-aligned (sticky "actions" id was the bug).
      header: t("products.stock.colAvailable"),
      cell: ({ row }) => {
        const { isLoading, stock } = row.original;

        return (
          <div className="min-w-[5.5rem]">
            <div className="font-medium tabular-nums">
              {isLoading
                ? t("products.stock.loading")
                : formatQuantity(stock?.availableQuantity ?? null, t)}
            </div>
            {!isLoading ? (
              <StockStateText
                availableQuantity={stock?.availableQuantity ?? stock?.stockedQuantity ?? null}
              />
            ) : null}
          </div>
        );
      },
    },
    {
      id: "reserved",
      accessorFn: (row) => row.stock?.reservedQuantity ?? 0,
      header: t("products.stock.colReserved"),
      cell: ({ row }) => (
        <span className="tabular-nums">
          {row.original.isLoading
            ? t("products.stock.loading")
            : formatQuantity(row.original.stock?.reservedQuantity ?? null, t)}
        </span>
      ),
    },
    {
      // Must not use id "actions" — DataTable treats that as sticky-right chrome.
      id: "stocked",
      header: t("products.stock.colStocked"),
      cell: ({ row }) => {
        const item = row.original;

        return (
          <form
            className="flex items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              item.onSubmit();
            }}
          >
            <Input
              aria-label={t("products.stock.stockedAria", {
                name: item.variant.title ?? item.variant.id,
              })}
              className="h-9 w-20 tabular-nums"
              min="0"
              onChange={(event) => item.onStockedQuantityChange(event.target.value)}
              step="1"
              type="number"
              value={item.stockedQuantity}
            />
            <Button disabled={item.isSaving || item.isLoading} size="sm" type="submit">
              {item.isSaving ? t("products.stock.saving") : t("products.stock.save")}
            </Button>
          </form>
        );
      },
    },
  ];
}

export function StockMetric({
  emphasis = false,
  label,
  value,
}: {
  emphasis?: boolean;
  label: string;
  value: string;
}) {
  return (
    <div
      className={
        emphasis
          ? "rounded-xl border bg-primary/5 px-3 py-2"
          : "rounded-xl border bg-background px-3 py-2"
      }
    >
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}

export function StockStateBadge({ availableQuantity }: { availableQuantity: number }) {
  const { t } = useI18n();
  return (
    <Badge variant={availableQuantity > 0 ? "default" : "secondary"}>
      {availableQuantity > 0
        ? t("products.stock.availableCount", { count: availableQuantity })
        : t("products.stock.outOfStock")}
    </Badge>
  );
}

export function StockStateText({ availableQuantity }: { availableQuantity: number | null }) {
  const { t } = useI18n();
  if (availableQuantity === null) {
    return <div className="text-xs text-muted-foreground">{t("products.stock.notTracked")}</div>;
  }

  return (
    <div
      className={
        availableQuantity > 0 ? "text-xs text-muted-foreground" : "text-xs text-destructive"
      }
    >
      {availableQuantity > 0 ? t("products.stock.readyToSell") : t("products.stock.needsRestock")}
    </div>
  );
}

export function VariantOptionSummary({
  variant,
}: {
  variant: NonNullable<MerchantProduct["variants"]>[number];
}) {
  const { t } = useI18n();
  const options = variant.optionValues ?? [];

  if (!options.length) {
    return null;
  }

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {options.map((option, index) => (
        <Badge key={`${option.optionTitle}-${option.value}-${index}`} variant="outline">
          {option.optionTitle ? `${option.optionTitle}: ` : ""}
          {option.value ?? t("products.stock.unset")}
        </Badge>
      ))}
    </div>
  );
}

export function getVariantStockAction(productId: string, variantId: string, tenantId?: string) {
  return getTenantScopedPath(
    dashboardRoutes.productVariantStockAction(productId, variantId),
    tenantId,
  );
}

export function StockAlert({ error }: { error?: string | undefined }) {
  const { t } = useI18n();
  const message = getStockErrorMessage(error, t);
  const title =
    error === "product_variant_unsupported"
      ? t("products.stock.variantUnsupportedTitle")
      : t("products.stock.unavailableTitle");

  return (
    <Alert variant={error === "product_variant_unsupported" ? "default" : "destructive"}>
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

export function getAvailableQuantity(stock: MerchantProductStock) {
  return stock.availableQuantity ?? stock.stockedQuantity ?? 0;
}

export function formatQuantity(value: number | null, t: Translate) {
  return typeof value === "number" ? String(value) : t("products.stock.notAvailable");
}

export function formatVariantPrice(
  variant: NonNullable<MerchantProduct["variants"]>[number],
  t: Translate,
) {
  const price = variant.prices.find(
    (variantPrice) => typeof variantPrice.amount === "number" && variantPrice.currencyCode,
  );

  if (!price || typeof price.amount !== "number" || !price.currencyCode) {
    return t("products.stock.noPrice");
  }

  return `${price.currencyCode.toUpperCase()} ${price.amount}`;
}

export function getStockErrorMessage(error: string | undefined, t: Translate) {
  if (error === "product_variant_unsupported") {
    return t("products.stock.errorVariantUnsupported");
  }

  if (error === "product_inventory_unavailable") {
    return t("products.stock.errorInventoryUnavailable");
  }

  if (error === "inventory_location_unavailable") {
    return t("products.stock.errorLocationUnavailable");
  }

  if (error === "invalid_stocked_quantity") {
    return t("products.stock.errorInvalidQuantity");
  }

  if (error === "product_not_found") {
    return t("products.stock.errorNotFound");
  }

  return t("products.stock.errorTemporary");
}
