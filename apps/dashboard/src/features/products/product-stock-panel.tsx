"use client";

import type {
  MerchantInventoryMovement,
  MerchantProduct,
  MerchantProductStock,
} from "@ecs/contracts";
import { usePermission } from "@/components/app/access-context";
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
  product: MerchantProduct;
  productId: string;
  stockError?: string | undefined;
  tenantId?: string | undefined;
};

export function ProductStockPanel({
  action,
  initialStock,
  initialMovements = [],
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
          stocks={variants.flatMap((variant) =>
            variant.stock
              ? [{
                  inventoryItemId: variant.inventoryItemId ?? null,
                  stockedQuantity: variant.stock.stockedQuantity,
                  variantId: variant.id,
                }]
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
        stocks={initialStock ? [initialStock] : []}
      />
    </>
  );
}

function InventoryMovementHistory({
  movements,
  stocks,
}: {
  movements: MerchantInventoryMovement[];
  stocks: Array<{
    inventoryItemId?: string | null | undefined;
    stockedQuantity: number | null;
    variantId?: string | undefined;
  }>;
}) {
  const { formatDateTime, t } = useI18n();
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
      ["date", "reason", "delta", "before", "after", "source", "note"],
      ...movements.map((movement) => [
        movement.createdAt,
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
      {movements.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("products.stock.historyEmpty")}</p>
      ) : (
        <div className="divide-y divide-border/60">
          {movements.map((movement) => (
            <div
              className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0"
              key={movement.id}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">
                    {t(`products.stock.reasons.${movement.reason}` as MessageKey)}
                  </p>
                  <Badge variant="secondary">
                    {t(`products.stock.sources.${movement.sourceType}` as MessageKey)}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatDateTime(movement.createdAt)}
                </p>
                {movement.note ? (
                  <p className="mt-1 text-sm text-muted-foreground">{movement.note}</p>
                ) : null}
              </div>
              <div className="shrink-0 text-right">
                <p className="font-mono text-sm font-semibold tabular-nums">
                  {movement.delta > 0 ? "+" : ""}
                  {movement.delta}
                </p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {movement.observedBefore ?? "—"} → {movement.observedAfter ?? "—"}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </DetailSection>
  );
}
