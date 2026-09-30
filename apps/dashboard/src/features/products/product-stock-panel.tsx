"use client";

import type {
  MerchantInventoryMovement,
  MerchantProduct,
  MerchantProductStock,
} from "@ecs/contracts";
import type { ColumnDef } from "@tanstack/react-table";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { usePermission } from "@/components/app/access-context";
import { DataTable } from "@/components/app/data-table";
import { DetailSection } from "@/components/app/detail-surface";
import { AppIcons } from "@/components/app/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  SingleVariantStockPanel,
  VariantStockPanel,
} from "@/features/products/product-stock-views";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/provider";

type ProductStockPanelProps = {
  action: string;
  initialStock?: MerchantProductStock | undefined;
  initialMovements?: MerchantInventoryMovement[] | undefined;
  movementFooter?: ReactNode;
  product: MerchantProduct;
  productId: string;
  stockError?: string | undefined;
  tenantId?: string | undefined;
};

export function ProductStockPanel({
  action,
  initialStock,
  initialMovements = [],
  movementFooter,
  product,
  productId,
  stockError,
  tenantId,
}: ProductStockPanelProps) {
  const canUpdate = usePermission("products.update");
  const variants = product.variants ?? [];

  if (variants.length > 1) {
    return (
      <>
        <VariantStockPanel
          canUpdate={canUpdate}
          productId={productId}
          tenantId={tenantId}
          variants={variants}
        />
        <InventoryMovementHistory
          movements={initialMovements}
          footer={movementFooter}
          variants={variants}
          stocks={variants.flatMap((variant) =>
            variant.stock
              ? [
                  {
                    inventoryItemId: variant.inventoryItemId ?? null,
                    stockedQuantity: variant.stock.stockedQuantity,
                    variantId: variant.id,
                  },
                ]
              : [],
          )}
        />
      </>
    );
  }

  return (
    <>
      <SingleVariantStockPanel
        action={action}
        canUpdate={canUpdate}
        initialStock={initialStock}
        productId={productId}
        stockError={stockError}
      />
      <InventoryMovementHistory
        movements={initialMovements}
        footer={movementFooter}
        stocks={initialStock ? [initialStock] : []}
        variants={variants}
      />
    </>
  );
}

function InventoryMovementHistory({
  movements,
  footer,
  stocks,
  variants,
}: {
  footer?: ReactNode;
  movements: MerchantInventoryMovement[];
  stocks: Array<{
    inventoryItemId?: string | null | undefined;
    stockedQuantity: number | null;
    variantId?: string | undefined;
  }>;
  variants: NonNullable<MerchantProduct["variants"]>;
}) {
  const { formatDateTime, t } = useI18n();
  const variantNames = useMemo(
    () =>
      new Map(
        variants.map((variant) => [
          variant.id,
          variant.title ?? variant.sku ?? t("products.stock.untitledVariant"),
        ]),
      ),
    [t, variants],
  );
  const latestByItem = new Map<string, MerchantInventoryMovement>();
  for (const movement of movements) {
    if (!latestByItem.has(movement.inventoryItemId))
      latestByItem.set(movement.inventoryItemId, movement);
  }
  const discrepancy = stocks.some((stock) => {
    const latest = stock.inventoryItemId
      ? latestByItem.get(stock.inventoryItemId)
      : movements.find((movement) => movement.variantId === stock.variantId);
    return latest?.observedAfter != null && latest.observedAfter !== stock.stockedQuantity;
  });
  function downloadCsv() {
    const escapeCsv = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const rows = [
      ["date", "variant", "reason", "delta", "before", "after", "source", "note"],
      ...movements.map((movement) => [
        movement.createdAt,
        movement.variantId ? (variantNames.get(movement.variantId) ?? movement.variantId) : "",
        movement.reason,
        movement.delta,
        movement.observedBefore,
        movement.observedAfter,
        movement.sourceType,
        movement.note,
      ]),
    ];
    const blob = new Blob([rows.map((row) => row.map(escapeCsv).join(",")).join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "stock-history.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }
  const columns = useMemo<ColumnDef<MerchantInventoryMovement>[]>(
    () => [
      {
        accessorKey: "createdAt",
        header: t("products.stock.historyDate"),
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground">
            {formatDateTime(row.original.createdAt)}
          </span>
        ),
      },
      ...(variants.length > 1
        ? [
            {
              id: "variant",
              header: t("products.stock.colVariant"),
              cell: ({ row }: { row: { original: MerchantInventoryMovement } }) => (
                <span className="font-medium">
                  {row.original.variantId
                    ? (variantNames.get(row.original.variantId) ?? row.original.variantId)
                    : "—"}
                </span>
              ),
            } satisfies ColumnDef<MerchantInventoryMovement>,
          ]
        : []),
      {
        accessorKey: "reason",
        header: t("products.stock.historyReason"),
        cell: ({ row }) => (
          <div className="min-w-[10rem]">
            <p className="font-medium">
              {t(`products.stock.reasons.${row.original.reason}` as MessageKey)}
            </p>
            {row.original.note ? (
              <p className="mt-0.5 text-xs text-muted-foreground">{row.original.note}</p>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: "sourceType",
        header: t("products.stock.historySource"),
        cell: ({ row }) => (
          <Badge variant="secondary">
            {t(`products.stock.sources.${row.original.sourceType}` as MessageKey)}
          </Badge>
        ),
      },
      {
        accessorKey: "delta",
        header: t("products.stock.historyChange"),
        cell: ({ row }) => (
          <span className="font-mono font-semibold tabular-nums">
            {row.original.delta > 0 ? "+" : ""}
            {row.original.delta}
          </span>
        ),
      },
      {
        id: "balance",
        header: t("products.stock.historyBalance"),
        cell: ({ row }) => (
          <span className="whitespace-nowrap font-mono text-muted-foreground tabular-nums">
            {row.original.observedBefore ?? "—"} → {row.original.observedAfter ?? "—"}
          </span>
        ),
      },
    ],
    [formatDateTime, t, variantNames, variants.length],
  );
  return (
    <DetailSection
      meta={
        movements.length ? (
          <Button onClick={downloadCsv} size="sm" type="button" variant="ghost">
            <AppIcons.download aria-hidden className="size-4" />
            {t("products.stock.historyExport")}
          </Button>
        ) : null
      }
      title={t("products.stock.historyTitle")}
    >
      {discrepancy ? (
        <Alert className="mb-3">
          <AlertTitle>{t("products.stock.historyDiscrepancyTitle")}</AlertTitle>
          <AlertDescription>{t("products.stock.historyDiscrepancyDescription")}</AlertDescription>
        </Alert>
      ) : null}
      <DataTable
        columns={columns}
        data={movements}
        emptyMessage={t("products.stock.historyEmpty")}
        emptyTitle={t("products.stock.historyTitle")}
        enableSorting={false}
        footer={footer}
        getRowId={(movement) => movement.id}
        embedded
      />
    </DetailSection>
  );
}
