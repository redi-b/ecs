"use client";

import type { MerchantProductStock } from "@ecs/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

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

type ProductStockPanelProps = {
  action: string;
  initialStock?: MerchantProductStock | undefined;
  productId: string;
  stockError?: string | undefined;
};

export function ProductStockPanel({
  action,
  initialStock,
  productId,
  stockError,
}: ProductStockPanelProps) {
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
            <CardDescription>Single-variant stock at the merchant stock location.</CardDescription>
          </div>
          <Badge variant={getAvailableQuantity(stock) > 0 ? "default" : "secondary"}>
            {getAvailableQuantity(stock)} available
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="grid gap-3 md:grid-cols-4">
          <StockMetric label="Stocked" value={formatQuantity(stock.stockedQuantity)} />
          <StockMetric label="Reserved" value={formatQuantity(stock.reservedQuantity)} />
          <StockMetric label="Incoming" value={formatQuantity(stock.incomingQuantity)} />
          <StockMetric label="Available" value={formatQuantity(stock.availableQuantity)} />
        </div>

        <form
          className="flex flex-col gap-3 rounded-xl border bg-muted/20 p-4 sm:flex-row sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate();
          }}
        >
          <Field className="flex-1">
            <FieldLabel htmlFor="stockedQuantity">Stocked quantity</FieldLabel>
            <Input
              id="stockedQuantity"
              min="0"
              onChange={(event) => setStockedQuantity(event.target.value)}
              step="1"
              type="number"
              value={stockedQuantity}
            />
            <FieldDescription>Updates the stocked quantity for this product.</FieldDescription>
          </Field>
          <Button disabled={mutation.isPending} type="submit">
            {mutation.isPending ? "Saving..." : "Update stock"}
          </Button>
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

function StockMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}

function StockAlert({ error }: { error?: string | undefined }) {
  const message = getStockErrorMessage(error);
  const title = error === "product_variant_unsupported" ? "Variant stock coming next" : "Stock unavailable";

  return (
    <Alert variant={error === "product_variant_unsupported" ? "default" : "destructive"}>
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

function getAvailableQuantity(stock: MerchantProductStock) {
  return stock.availableQuantity ?? stock.stockedQuantity ?? 0;
}

function formatQuantity(value: number | null) {
  return typeof value === "number" ? String(value) : "Not available";
}

function getStockErrorMessage(error: string | undefined) {
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
