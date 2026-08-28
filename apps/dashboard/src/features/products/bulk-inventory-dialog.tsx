"use client";

import type { MerchantProduct } from "@ecs/contracts";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/i18n/provider";
import { dashboardRoutes } from "@/lib/routes";

type Row = {
  key: string;
  label: string;
  productId: string;
  stockedQuantity: string;
  variantId: string;
};

export function BulkInventoryDialog({
  onOpenChange,
  onSaved,
  open,
  products,
}: {
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  open: boolean;
  products: MerchantProduct[];
}) {
  const { t } = useI18n();
  const initialRows = useMemo<Row[]>(
    () =>
      products.flatMap((product) =>
        (product.variants ?? []).map((variant) => ({
          key: `${product.id}:${variant.id}`,
          label: `${product.title ?? product.handle ?? product.id} — ${variant.title ?? variant.sku ?? variant.id}`,
          productId: product.id,
          stockedQuantity: String(variant.stock?.stockedQuantity ?? 0),
          variantId: variant.id,
        })),
      ),
    [products],
  );
  const [rows, setRows] = useState(initialRows);
  const [saving, setSaving] = useState(false);
  const tooLarge = rows.length > 50;

  useEffect(() => setRows(initialRows), [initialRows]);

  async function save() {
    const updates = rows.map((row) => ({
      productId: row.productId,
      variantId: row.variantId,
      stockedQuantity: Number(row.stockedQuantity),
    }));
    if (
      updates.length === 0 ||
      updates.some(
        (row) =>
          !Number.isInteger(row.stockedQuantity) ||
          row.stockedQuantity < 0 ||
          row.stockedQuantity > 1_000_000_000,
      )
    ) {
      toast.error(t("products.stock.bulkInvalid"));
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(dashboardRoutes.productsBatchInventoryAction, {
        method: "POST",
        headers: { accept: "application/json", "content-type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "inventory_batch_update_failed");
      const failed = typeof data.failed === "number" ? data.failed : 0;
      const succeeded = typeof data.succeeded === "number" ? data.succeeded : 0;
      if (failed > 0) {
        const failedKeys = new Set(
          Array.isArray(data.results)
            ? data.results
                .filter((result: { ok?: unknown }) => result?.ok === false)
                .map(
                  (result: { productId?: unknown; variantId?: unknown }) =>
                    `${String(result.productId ?? "")}:${String(result.variantId ?? "")}`,
                )
            : [],
        );
        setRows((current) => current.filter((row) => failedKeys.has(row.key)));
        toast.warning(t("products.stock.bulkPartial", { failed, succeeded }));
        onSaved();
      } else {
        toast.success(t("products.stock.bulkUpdated", { count: succeeded }));
        onOpenChange(false);
        onSaved();
      }
    } catch {
      toast.error(t("products.stock.bulkFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      onOpenChange={(nextOpen) => {
        if (!saving) onOpenChange(nextOpen);
      }}
      open={open}
    >
      <DialogContent className="max-h-[min(90vh,48rem)] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("products.stock.bulkTitle")}</DialogTitle>
          <DialogDescription>{t("products.stock.bulkDescription")}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
          {rows.map((row, index) => (
            <label
              className="grid grid-cols-[minmax(0,1fr)_8rem] items-center gap-3 rounded-lg border p-3"
              htmlFor={`bulk-stock-${index}`}
              key={row.key}
            >
              <span className="truncate text-sm font-medium">{row.label}</span>
              <Input
                aria-label={t("products.stock.stockedAria", { name: row.label })}
                disabled={saving}
                inputMode="numeric"
                id={`bulk-stock-${index}`}
                min={0}
                onChange={(event) =>
                  setRows((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, stockedQuantity: event.target.value } : item,
                    ),
                  )
                }
                step={1}
                type="number"
                value={row.stockedQuantity}
              />
            </label>
          ))}
        </div>
        {tooLarge ? (
          <p className="text-sm text-destructive">{t("products.stock.bulkTooLarge")}</p>
        ) : null}
        <DialogFooter showCloseButton>
          <Button disabled={saving || tooLarge || rows.length === 0} onClick={() => void save()}>
            {saving ? t("products.stock.saving") : t("products.stock.bulkSave")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
