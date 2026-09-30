"use client";

import type { MerchantProduct, MerchantProductStock } from "@ecs/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { type ComponentProps, useEffect, useId, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/app/data-table";
import { DetailMetric, DetailSection } from "@/components/app/detail-surface";
import { HelpTip } from "@/components/app/help-tip";
import { AppIcons } from "@/components/app/icons";
import { UnsavedChangesDialog } from "@/components/app/unsaved-changes-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/provider";
import { createClientId } from "@/lib/client-id";
import { getTenantScopedPath } from "@/lib/dashboard-tenant-context";
import { rankFuzzyItems } from "@/lib/fuzzy-search";
import { dashboardRoutes } from "@/lib/routes";

type Translate = (key: MessageKey, values?: Record<string, string | number | Date>) => string;

type VariantInventoryRow = {
  error: string | undefined;
  isLoading: boolean;
  isSaving: boolean;
  onStockedQuantityChange: (value: string) => void;
  onAdjustmentSaved: (stock: MerchantProductStock) => void;
  onSubmit: () => void;
  productId: string;
  stock: MerchantProductStock | undefined;
  stockedQuantity: string;
  tenantId?: string | undefined;
  variant: NonNullable<MerchantProduct["variants"]>[number];
};

function StockOperationLabel({
  label,
  operation,
}: {
  label: string;
  operation: "add" | "remove" | "set";
}) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <span
        aria-hidden
        className={
          operation === "add"
            ? "font-mono text-sm font-semibold text-success"
            : operation === "remove"
              ? "font-mono text-sm font-semibold text-destructive"
              : "font-mono text-sm font-semibold text-muted-foreground"
        }
      >
        {operation === "add" ? "+" : operation === "remove" ? "−" : "="}
      </span>
      <span className="truncate">{label}</span>
    </span>
  );
}

function StockQuantityInput({
  operation,
  ...props
}: ComponentProps<typeof InputGroupInput> & {
  operation: "add" | "remove" | "set";
}) {
  return (
    <InputGroup>
      <InputGroupAddon
        aria-hidden
        className={
          operation === "add"
            ? "font-mono text-base font-semibold text-success"
            : operation === "remove"
              ? "font-mono text-base font-semibold text-destructive"
              : "font-mono text-base font-semibold text-muted-foreground"
        }
      >
        {operation === "add" ? "+" : operation === "remove" ? "−" : "="}
      </InputGroupAddon>
      <InputGroupInput {...props} />
    </InputGroup>
  );
}

export function SingleVariantStockPanel({
  action,
  canUpdate,
  initialStock,
  productId,
  stockError,
}: {
  action: string;
  canUpdate: boolean;
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
  const [adjustmentTask, setAdjustmentTask] = useState<"add" | "remove" | "set">("set");
  const [adjustmentNote, setAdjustmentNote] = useState("");
  const mutationKey = useRef<{ fingerprint: string; key: string } | null>(null);

  const baselineQuantity =
    stock?.stockedQuantity === null || stock?.stockedQuantity === undefined
      ? ""
      : String(stock.stockedQuantity);
  const stockDirty =
    adjustmentTask === "set" ? stockedQuantity !== baselineQuantity : stockedQuantity !== "";
  const { leaveDialogOpen, confirmLeave, cancelLeave } = useUnsavedChangesGuard(stockDirty);

  const mutation = useMutation({
    mutationFn: async () => {
      const parsedQuantity = Number.parseInt(stockedQuantity, 10);

      if (!Number.isInteger(parsedQuantity) || parsedQuantity < 0) {
        throw new Error(t("products.stock.enterWholeNumber"));
      }
      const current = stock?.stockedQuantity ?? 0;
      const target =
        adjustmentTask === "add"
          ? current + parsedQuantity
          : adjustmentTask === "remove"
            ? current - parsedQuantity
            : parsedQuantity;
      if (target < 0) throw new Error(t("products.stock.removeTooMany"));
      if (adjustmentTask === "remove" && !adjustmentNote.trim()) {
        throw new Error(t("products.stock.noteRequired"));
      }
      const reason =
        adjustmentTask === "add"
          ? "stock_received"
          : adjustmentTask === "remove"
            ? "correction_remove"
            : "manual_count";
      const fingerprint = `${adjustmentTask}:${target}:${adjustmentNote.trim()}`;
      if (mutationKey.current?.fingerprint !== fingerprint) {
        mutationKey.current = { fingerprint, key: createClientId("inventory-stock") };
      }

      const response = await fetch(action, {
        body: JSON.stringify({
          note: adjustmentNote.trim() || undefined,
          reason,
          stockedQuantity: target,
        }),
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "idempotency-key": mutationKey.current.key,
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
      mutationKey.current = null;
      setAdjustmentTask("set");
      setAdjustmentNote("");
      setStock(nextStock);
      setStockedQuantity(
        nextStock.stockedQuantity === null || nextStock.stockedQuantity === undefined
          ? ""
          : String(nextStock.stockedQuantity),
      );
      setActionError(null);
      await queryClient.invalidateQueries({ queryKey: ["product", productId] });
      toast.success(t("products.stock.toastUpdated"));
      router.refresh();
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : t("products.stock.couldNotUpdate");

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
    <>
      <DetailSection
        meta={<StockStateBadge availableQuantity={getAvailableQuantity(stock)} />}
        title={t("products.stock.title")}
      >
        <p className="-mt-1 text-sm text-muted-foreground">
          {t("products.stock.locationDescription")}
        </p>
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
            help={t("products.stock.reservedHelp")}
            label={t("products.stock.reserved")}
            value={formatQuantity(stock.reservedQuantity, t)}
          />
          <DetailMetric
            label={t("products.stock.incoming")}
            value={formatQuantity(stock.incomingQuantity, t)}
          />
        </div>

        {canUpdate ? (
          <form
            className="rounded-xl bg-muted/25 p-4 ring-1 ring-foreground/[0.06]"
            onSubmit={(event) => {
              event.preventDefault();
              mutation.mutate();
            }}
          >
            <div className="space-y-3">
              <SegmentedControl
                active="muted"
                ariaLabel={t("products.stock.adjustmentTask")}
                onChange={(task) => {
                  setAdjustmentTask(task);
                  setStockedQuantity(task === "set" ? baselineQuantity : "");
                }}
                options={[
                  {
                    id: "add",
                    label: (
                      <StockOperationLabel label={t("products.stock.addStock")} operation="add" />
                    ),
                  },
                  {
                    id: "remove",
                    label: (
                      <StockOperationLabel
                        label={t("products.stock.removeStock")}
                        operation="remove"
                      />
                    ),
                  },
                  {
                    id: "set",
                    label: (
                      <StockOperationLabel label={t("products.stock.setCount")} operation="set" />
                    ),
                  },
                ]}
                size="sm"
                value={adjustmentTask}
              />
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <Field className="max-w-xs flex-1">
                  <div className="flex items-center gap-1.5">
                    <FieldLabel htmlFor={stockedQuantityInputId}>
                      {adjustmentTask === "set"
                        ? t("products.stock.countedQuantity")
                        : t("products.stock.adjustmentQuantity")}
                    </FieldLabel>
                    <HelpTip summary={t("products.stock.adjustmentQuantityHelp")} />
                  </div>
                  <StockQuantityInput
                    id={stockedQuantityInputId}
                    min="0"
                    onChange={(event) => setStockedQuantity(event.target.value)}
                    operation={adjustmentTask}
                    step="1"
                    type="number"
                    value={stockedQuantity}
                  />
                </Field>
                <Button disabled={mutation.isPending} type="submit">
                  {mutation.isPending ? t("products.stock.saving") : t("products.stock.saveStock")}
                </Button>
              </div>
              {adjustmentTask === "remove" ? (
                <Field>
                  <FieldLabel htmlFor={`${stockedQuantityInputId}-note`}>
                    {t("products.stock.adjustmentNote")}
                  </FieldLabel>
                  <Input
                    id={`${stockedQuantityInputId}-note`}
                    onChange={(event) => setAdjustmentNote(event.target.value)}
                    placeholder={t("products.stock.adjustmentNotePlaceholder")}
                    value={adjustmentNote}
                  />
                </Field>
              ) : null}
              {stockedQuantity !== "" && Number.isInteger(Number(stockedQuantity)) ? (
                <p className="text-xs text-muted-foreground">
                  {t("products.stock.afterPreview", {
                    count:
                      adjustmentTask === "add"
                        ? (stock?.stockedQuantity ?? 0) + Number(stockedQuantity)
                        : adjustmentTask === "remove"
                          ? (stock?.stockedQuantity ?? 0) - Number(stockedQuantity)
                          : Number(stockedQuantity),
                  })}
                </p>
              ) : null}
            </div>
          </form>
        ) : null}

        {actionError ? (
          <Alert variant="destructive">
            <AlertTitle>{t("products.stock.updateFailedTitle")}</AlertTitle>
            <AlertDescription>{actionError}</AlertDescription>
          </Alert>
        ) : null}
      </DetailSection>
      <UnsavedChangesDialog onLeave={confirmLeave} onStay={cancelLeave} open={leaveDialogOpen} />
    </>
  );
}

export function VariantStockPanel({
  canUpdate,
  productId,
  tenantId,
  variants,
}: {
  canUpdate: boolean;
  productId: string;
  tenantId?: string | undefined;
  variants: NonNullable<MerchantProduct["variants"]>;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const queryClient = useQueryClient();
  const initialStockByVariantId = useMemo(
    () =>
      Object.fromEntries(
        variants.flatMap((variant) => {
          if (!variant.stock) return [];
          return [
            [
              variant.id,
              {
                ...variant.stock,
                productId,
                variantId: variant.id,
                inventoryItemId: variant.inventoryItemId ?? null,
              },
            ],
          ];
        }),
      ) as Record<string, MerchantProductStock>,
    [productId, variants],
  );
  const [stockByVariantId, setStockByVariantId] =
    useState<Record<string, MerchantProductStock>>(initialStockByVariantId);
  const [stockedQuantityByVariantId, setStockedQuantityByVariantId] = useState<
    Record<string, string>
  >({});
  const [errorByVariantId, setErrorByVariantId] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(
    variants.some((variant) => !initialStockByVariantId[variant.id]),
  );
  const stocks = Object.values(stockByVariantId);
  const totalAvailable = stocks.reduce(
    (total, stock) => total + (stock.availableQuantity ?? stock.stockedQuantity ?? 0),
    0,
  );
  const totalReserved = stocks.reduce((total, stock) => total + (stock.reservedQuantity ?? 0), 0);
  const totalStocked = stocks.reduce((total, stock) => total + (stock.stockedQuantity ?? 0), 0);
  const [query, setQuery] = useState("");
  const filteredVariants = useMemo(() => {
    return rankFuzzyItems(variants, query, (variant) =>
      [
        variant.id,
        variant.title,
        variant.sku,
        formatVariantPrice(variant, t),
        ...(variant.optionValues ?? []).flatMap((option) => [option.optionTitle, option.value]),
      ]
        .filter(Boolean)
        .join(" "),
    );
  }, [query, t, variants]);
  const columns = useMemo(() => getVariantInventoryColumns(t, canUpdate), [canUpdate, t]);

  const multiStockDirty = useMemo(() => {
    return variants.some((variant) => {
      const stock = stockByVariantId[variant.id];
      const baseline =
        stock?.stockedQuantity === null || stock?.stockedQuantity === undefined
          ? ""
          : String(stock.stockedQuantity);
      const current = stockedQuantityByVariantId[variant.id] ?? baseline;
      return current !== baseline;
    });
  }, [stockByVariantId, stockedQuantityByVariantId, variants]);
  const { leaveDialogOpen, confirmLeave, cancelLeave } = useUnsavedChangesGuard(multiStockDirty);
  const mutationKeys = useRef(new Map<string, string>());

  useEffect(() => {
    let cancelled = false;

    async function loadVariantStock() {
      const variantsMissingStock = variants.filter(
        (variant) => !initialStockByVariantId[variant.id],
      );
      if (variantsMissingStock.length === 0) {
        setStockByVariantId(initialStockByVariantId);
        setStockedQuantityByVariantId(
          Object.fromEntries(
            Object.entries(initialStockByVariantId).flatMap(([variantId, stock]) =>
              stock.stockedQuantity === null || stock.stockedQuantity === undefined
                ? []
                : [[variantId, String(stock.stockedQuantity)]],
            ),
          ),
        );
        setErrorByVariantId({});
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      const results = await Promise.all(
        variantsMissingStock.map(async (variant) => {
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
        Object.fromEntries([
          ...Object.entries(initialStockByVariantId),
          ...results.flatMap((result) =>
            result.stock ? ([[result.variantId, result.stock]] as const) : [],
          ),
        ]),
      );
      setStockedQuantityByVariantId(
        Object.fromEntries(
          [
            ...Object.entries(initialStockByVariantId),
            ...results.flatMap((result) =>
              result.stock ? ([[result.variantId, result.stock]] as const) : [],
            ),
          ].flatMap(([variantId, stock]) =>
            stock.stockedQuantity === null || stock.stockedQuantity === undefined
              ? []
              : [[variantId, String(stock.stockedQuantity)]],
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
  }, [initialStockByVariantId, productId, t, tenantId, variants]);

  const mutation = useMutation({
    mutationFn: async (variantId: string) => {
      const rawQuantity = stockedQuantityByVariantId[variantId] ?? "";
      const parsedQuantity = Number.parseInt(rawQuantity, 10);

      if (!Number.isInteger(parsedQuantity) || parsedQuantity < 0) {
        throw new Error(t("products.stock.enterWholeNumber"));
      }

      const mutationIdentity = `${variantId}:${parsedQuantity}`;
      const idempotencyKey =
        mutationKeys.current.get(mutationIdentity) ?? createClientId("inventory-stock");
      mutationKeys.current.set(mutationIdentity, idempotencyKey);

      const response = await fetch(getVariantStockAction(productId, variantId, tenantId), {
        body: JSON.stringify({
          reason: "manual_count",
          stockedQuantity: parsedQuantity,
        }),
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "idempotency-key": idempotencyKey,
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
      for (const key of mutationKeys.current.keys()) {
        if (key.startsWith(`${nextStock.variantId}:`)) mutationKeys.current.delete(key);
      }
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
      const message = error instanceof Error ? error.message : t("products.stock.couldNotUpdate");

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
        onAdjustmentSaved: (nextStock) => {
          setStockByVariantId((current) => ({ ...current, [variant.id]: nextStock }));
          setStockedQuantityByVariantId((current) => ({
            ...current,
            [variant.id]: String(nextStock.stockedQuantity ?? 0),
          }));
          void queryClient.invalidateQueries({ queryKey: ["product", productId] });
          router.refresh();
        },
        onSubmit: () => mutation.mutate(variant.id),
        productId,
        stock: stockByVariantId[variant.id],
        stockedQuantity: stockedQuantityByVariantId[variant.id] ?? "",
        tenantId,
        variant,
      })),
    [
      errorByVariantId,
      filteredVariants,
      isLoading,
      mutation,
      productId,
      queryClient,
      router,
      stockByVariantId,
      stockedQuantityByVariantId,
      tenantId,
    ],
  );

  return (
    <>
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
        <p className="-mt-1 text-sm text-muted-foreground">
          {t("products.stock.variantDescription")}
        </p>
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
      <UnsavedChangesDialog onLeave={confirmLeave} onStay={cancelLeave} open={leaveDialogOpen} />
    </>
  );
}

export function getVariantInventoryColumns(
  t: Translate,
  canUpdate = true,
): ColumnDef<VariantInventoryRow>[] {
  const columns: ColumnDef<VariantInventoryRow>[] = [
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
      header: () => (
        <span className="inline-flex items-center gap-1.5">
          <span>{t("products.stock.colReserved")}</span>
          <HelpTip summary={t("products.stock.reservedHelp")} />
        </span>
      ),
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
          <div className="flex items-center gap-2">
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
            <VariantStockDeltaDialog row={item} />
          </div>
        );
      },
    },
  ];
  return canUpdate ? columns : columns.filter((column) => column.id !== "stocked");
}

function VariantStockDeltaDialog({ row }: { row: VariantInventoryRow }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [task, setTask] = useState<"add" | "remove">("add");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const replay = useRef<{ fingerprint: string; key: string } | null>(null);
  const mutation = useMutation({
    mutationFn: async () => {
      const amount = Number(quantity);
      const current = row.stock?.stockedQuantity ?? 0;
      if (!Number.isInteger(amount) || amount <= 0) {
        throw new Error(t("products.stock.enterWholeNumber"));
      }
      if (task === "remove" && !note.trim()) {
        throw new Error(t("products.stock.noteRequired"));
      }
      const target = task === "add" ? current + amount : current - amount;
      if (target < 0) throw new Error(t("products.stock.removeTooMany"));
      const fingerprint = `${task}:${target}:${note.trim()}`;
      if (replay.current?.fingerprint !== fingerprint) {
        replay.current = { fingerprint, key: createClientId("inventory-stock") };
      }
      const response = await fetch(
        getVariantStockAction(row.productId, row.variant.id, row.tenantId),
        {
          body: JSON.stringify({
            note: note.trim() || undefined,
            reason: task === "add" ? "stock_received" : "correction_remove",
            stockedQuantity: target,
          }),
          headers: {
            accept: "application/json",
            "content-type": "application/json",
            "idempotency-key": replay.current.key,
          },
          method: "POST",
        },
      );
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        stock?: MerchantProductStock;
      };
      if (!response.ok || !data.stock) throw new Error(getStockErrorMessage(data.error, t));
      return data.stock;
    },
    onError: (cause) => {
      setError(cause instanceof Error ? cause.message : t("products.stock.couldNotUpdate"));
    },
    onSuccess: (stock) => {
      replay.current = null;
      row.onAdjustmentSaved(stock);
      toast.success(t("products.stock.toastVariantUpdated"));
      setOpen(false);
      setQuantity("");
      setNote("");
      setError(null);
    },
  });

  return (
    <Dialog onOpenChange={(next) => !mutation.isPending && setOpen(next)} open={open}>
      <DialogTrigger asChild>
        <Button disabled={row.isLoading} size="sm" type="button" variant="outline">
          {t("products.stock.adjust")}
        </Button>
      </DialogTrigger>
      <DialogContent className="gap-0 overflow-visible p-0 sm:max-w-md">
        <DialogHeader className="gap-1.5 border-b px-4 py-4 pr-12 text-left sm:px-5">
          <DialogTitle>
            {t("products.stock.adjustVariant", { name: row.variant.title ?? row.variant.id })}
          </DialogTitle>
          <DialogDescription>{t("products.stock.adjustVariantDescription")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 px-4 py-5 sm:px-5">
          <SegmentedControl
            active="muted"
            ariaLabel={t("products.stock.adjustmentTask")}
            onChange={(value) => {
              setTask(value);
              setError(null);
            }}
            options={[
              {
                id: "add",
                label: <StockOperationLabel label={t("products.stock.addStock")} operation="add" />,
              },
              {
                id: "remove",
                label: (
                  <StockOperationLabel label={t("products.stock.removeStock")} operation="remove" />
                ),
              },
            ]}
            size="sm"
            value={task}
          />
          <Field>
            <div className="flex items-center gap-1.5">
              <FieldLabel>{t("products.stock.adjustmentQuantity")}</FieldLabel>
              <HelpTip summary={t("products.stock.adjustmentQuantityHelp")} />
            </div>
            <StockQuantityInput
              min="1"
              onChange={(event) => setQuantity(event.target.value)}
              operation={task}
              step="1"
              type="number"
              value={quantity}
            />
          </Field>
          {task === "remove" ? (
            <Field>
              <FieldLabel>{t("products.stock.adjustmentNote")}</FieldLabel>
              <Input
                onChange={(event) => setNote(event.target.value)}
                placeholder={t("products.stock.adjustmentNotePlaceholder")}
                value={note}
              />
            </Field>
          ) : null}
          {quantity !== "" && Number.isInteger(Number(quantity)) ? (
            <p className="rounded-lg bg-muted/35 px-3 py-2 text-sm font-medium tabular-nums text-foreground ring-1 ring-border/60">
              {t("products.stock.afterPreview", {
                count:
                  task === "add"
                    ? (row.stock?.stockedQuantity ?? 0) + Number(quantity)
                    : (row.stock?.stockedQuantity ?? 0) - Number(quantity),
              })}
            </p>
          ) : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter className="mx-0 mb-0 rounded-b-xl border-t bg-muted/50 p-4">
          <Button disabled={mutation.isPending || !quantity} onClick={() => mutation.mutate()}>
            {mutation.isPending ? t("products.stock.saving") : t("products.stock.saveStock")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
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
