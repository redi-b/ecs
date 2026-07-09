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


import {
  SingleVariantStockPanel,
  VariantStockPanel,
  getStockErrorMessage,
} from "@/features/products/product-stock-views";

export function ProductStockPanel({
  action,
  initialStock,
  product,
  productId,
  stockError,
  tenantId,
}: ProductStockPanelProps) {
  const variants = product.variants ?? [];

  if (variants.length > 1) {
    return (
      <VariantStockPanel
        productId={productId}
        tenantId={tenantId}
        variants={variants}
      />
    );
  }

  return (
    <SingleVariantStockPanel
      action={action}
      initialStock={initialStock}
      productId={productId}
      stockError={stockError}
    />
  );
}

