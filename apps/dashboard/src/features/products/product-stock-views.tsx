"use client";

import type { MerchantProduct, MerchantProductStock } from "@ecs/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/app/data-table";
import { AppIcons } from "@/components/app/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { getTenantScopedPath } from "@/lib/dashboard-tenant-context";
import { dashboardRoutes } from "@/lib/routes";

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
  const router = useRouter();
  const queryClient = useQueryClient();
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
        throw new Error("Enter a whole number stock quantity.");
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
        throw new Error(getStockErrorMessage(data.error));
      }

      return data.stock;
    },
    onSuccess: async (nextStock) => {
      setStock(nextStock);
      setActionError(null);
      await queryClient.invalidateQueries({ queryKey: ["product", productId] });
      toast.success("Stock updated.");
      router.refresh();
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Stock could not be updated.";

      setActionError(message);
    },
  });

  if (!stock) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Stock</CardTitle>
          <CardDescription>Track available inventory for this product.</CardDescription>
        </CardHeader>
        <CardContent>
          <StockAlert error={stockError} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Stock</CardTitle>
            <CardDescription>Inventory at the merchant stock location.</CardDescription>
          </div>
          <StockStateBadge availableQuantity={getAvailableQuantity(stock)} />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="grid gap-3 md:grid-cols-4">
          <StockMetric
            emphasis
            label="Available"
            value={formatQuantity(stock.availableQuantity)}
          />
          <StockMetric label="Stocked" value={formatQuantity(stock.stockedQuantity)} />
          <StockMetric label="Reserved" value={formatQuantity(stock.reservedQuantity)} />
          <StockMetric label="Incoming" value={formatQuantity(stock.incomingQuantity)} />
        </div>

        <form
          className="rounded-2xl border bg-muted/20 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate();
          }}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <Field className="max-w-xs flex-1">
              <FieldLabel htmlFor="stockedQuantity">Set stocked quantity</FieldLabel>
              <Input
                id="stockedQuantity"
                min="0"
                onChange={(event) => setStockedQuantity(event.target.value)}
                step="1"
                type="number"
                value={stockedQuantity}
              />
              <FieldDescription>Reserved stock is calculated from orders.</FieldDescription>
            </Field>
            <Button disabled={mutation.isPending} type="submit">
              {mutation.isPending ? "Saving..." : "Save stock"}
            </Button>
          </div>
        </form>

        {actionError ? (
          <Alert variant="destructive">
            <AlertTitle>Stock could not be updated</AlertTitle>
            <AlertDescription>{actionError}</AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
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
        formatVariantPrice(variant),
        ...(variant.optionValues ?? []).flatMap((option) => [
          option.optionTitle,
          option.value,
        ]),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)),
    );
  }, [query, variants]);
  const columns = useMemo(() => getVariantInventoryColumns(), []);

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
            error: response?.ok && data.stock ? null : getStockErrorMessage(data.error),
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
          results.flatMap((result) =>
            result.error ? [[result.variantId, result.error]] : [],
          ),
        ),
      );
      setIsLoading(false);
    }

    void loadVariantStock();

    return () => {
      cancelled = true;
    };
  }, [productId, tenantId, variants]);

  const mutation = useMutation({
    mutationFn: async (variantId: string) => {
      const rawQuantity = stockedQuantityByVariantId[variantId] ?? "";
      const parsedQuantity = Number.parseInt(rawQuantity, 10);

      if (!Number.isInteger(parsedQuantity) || parsedQuantity < 0) {
        throw new Error("Enter a whole number stock quantity.");
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
        throw new Error(getStockErrorMessage(data.error));
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
      toast.success("Variant stock updated.");
      router.refresh();
    },
    onError: (error, variantId) => {
      const message = error instanceof Error ? error.message : "Stock could not be updated.";

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
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Variant stock</CardTitle>
            <CardDescription>Inventory at the merchant location for each sellable variant.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{variants.length} variants</Badge>
            <StockStateBadge availableQuantity={totalAvailable} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <StockMetric emphasis label="Available" value={isLoading ? "Loading..." : String(totalAvailable)} />
          <StockMetric label="Stocked" value={isLoading ? "Loading..." : String(totalStocked)} />
          <StockMetric label="Reserved" value={isLoading ? "Loading..." : String(totalReserved)} />
        </div>

        <DataTable
          columns={columns}
          data={rows}
          emptyMessage="No variants match this search."
          emptyTitle="No matching variants"
          getRowId={(row) => row.variant.id}
          isFiltered={Boolean(query.trim())}
          pageSize={8}
          toolbar={
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-sm font-medium">Variant inventory</h3>
              <p className="text-sm text-muted-foreground">
                Search variants, review price, and set stocked quantities.
              </p>
            </div>
            <div className="relative md:w-72">
              <AppIcons.search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                data-icon="inline-start"
              />
              <Input
                aria-label="Search variants"
                className="h-9 pl-9"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search variant, SKU, option"
                value={query}
              />
            </div>
          </div>
          }
        />
      </CardContent>
    </Card>
  );
}

export function getVariantInventoryColumns(): ColumnDef<VariantInventoryRow>[] {
  return [
    {
      accessorFn: (row) => row.variant.title ?? row.variant.id,
      header: "Variant",
      cell: ({ row }) => {
        const { error, variant } = row.original;

        return (
          <div className="w-64 max-w-64 whitespace-normal">
            <div className="font-medium">{variant.title ?? "Untitled variant"}</div>
            <div className="break-all text-xs text-muted-foreground">{variant.id}</div>
            <VariantOptionSummary variant={variant} />
            {error ? <div className="mt-2 text-xs text-destructive">{error}</div> : null}
          </div>
        );
      },
    },
    {
      accessorFn: (row) => row.variant.sku ?? "",
      header: "SKU",
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.variant.sku ?? "No SKU"}</span>
      ),
    },
    {
      accessorFn: (row) => formatVariantPrice(row.variant),
      header: "Price",
      cell: ({ row }) => formatVariantPrice(row.original.variant),
    },
    {
      accessorFn: (row) => row.stock?.availableQuantity ?? row.stock?.stockedQuantity ?? 0,
      header: "Available",
      cell: ({ row }) => {
        const { isLoading, stock } = row.original;

        return (
          <div className="text-right">
            <div className="font-medium">
              {isLoading ? "Loading..." : formatQuantity(stock?.availableQuantity ?? null)}
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
      accessorFn: (row) => row.stock?.reservedQuantity ?? 0,
      header: "Reserved",
      cell: ({ row }) => (
        <div className="text-right">
          {row.original.isLoading
            ? "Loading..."
            : formatQuantity(row.original.stock?.reservedQuantity ?? null)}
        </div>
      ),
    },
    {
      id: "actions",
      header: "Stocked",
      cell: ({ row }) => {
        const item = row.original;

        return (
          <form
            className="flex items-center justify-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              item.onSubmit();
            }}
          >
            <Input
              aria-label={`Stocked quantity for ${item.variant.title ?? item.variant.id}`}
              className="h-9 w-24"
              min="0"
              onChange={(event) => item.onStockedQuantityChange(event.target.value)}
              step="1"
              type="number"
              value={item.stockedQuantity}
            />
            <Button disabled={item.isSaving || item.isLoading} size="sm" type="submit">
              {item.isSaving ? "Saving..." : "Save"}
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
    <div className={emphasis ? "rounded-xl border bg-primary/5 px-3 py-2" : "rounded-xl border bg-background px-3 py-2"}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}

export function StockStateBadge({ availableQuantity }: { availableQuantity: number }) {
  return (
    <Badge variant={availableQuantity > 0 ? "default" : "secondary"}>
      {availableQuantity > 0 ? `${availableQuantity} available` : "Out of stock"}
    </Badge>
  );
}

export function StockStateText({ availableQuantity }: { availableQuantity: number | null }) {
  if (availableQuantity === null) {
    return <div className="text-xs text-muted-foreground">Not tracked</div>;
  }

  return (
    <div className={availableQuantity > 0 ? "text-xs text-muted-foreground" : "text-xs text-destructive"}>
      {availableQuantity > 0 ? "Ready to sell" : "Needs restock"}
    </div>
  );
}

export function VariantOptionSummary({
  variant,
}: {
  variant: NonNullable<MerchantProduct["variants"]>[number];
}) {
  const options = variant.optionValues ?? [];

  if (!options.length) {
    return null;
  }

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {options.map((option, index) => (
        <Badge key={`${option.optionTitle}-${option.value}-${index}`} variant="outline">
          {option.optionTitle ? `${option.optionTitle}: ` : ""}
          {option.value ?? "Unset"}
        </Badge>
      ))}
    </div>
  );
}

export function getVariantStockAction(productId: string, variantId: string, tenantId?: string) {
  return getTenantScopedPath(dashboardRoutes.productVariantStockAction(productId, variantId), tenantId);
}

export function StockAlert({ error }: { error?: string | undefined }) {
  const message = getStockErrorMessage(error);
  const title = error === "product_variant_unsupported" ? "Variant stock coming next" : "Stock unavailable";

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

export function formatQuantity(value: number | null) {
  return typeof value === "number" ? String(value) : "Not available";
}

export function formatVariantPrice(variant: NonNullable<MerchantProduct["variants"]>[number]) {
  const price = variant.prices.find(
    (variantPrice) => typeof variantPrice.amount === "number" && variantPrice.currencyCode,
  );

  if (!price || typeof price.amount !== "number" || !price.currencyCode) {
    return "No price";
  }

  return `${price.currencyCode.toUpperCase()} ${price.amount}`;
}

export function getStockErrorMessage(error: string | undefined) {
  if (error === "product_variant_unsupported") {
    return "This product has multiple variants. Variant-level stock management is the next stock step.";
  }

  if (error === "product_inventory_unavailable") {
    return "Stock is not configured for this product yet.";
  }

  if (error === "inventory_location_unavailable") {
    return "Stock location is not configured for this shop.";
  }

  if (error === "invalid_stocked_quantity") {
    return "Enter a whole number stock quantity.";
  }

  if (error === "product_not_found") {
    return "This product is no longer available.";
  }

  return "Stock data is temporarily unavailable. Try again.";
}

