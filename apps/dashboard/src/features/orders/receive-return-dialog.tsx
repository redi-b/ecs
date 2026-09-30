"use client";

import type { MerchantOrder, MerchantOrderReturn } from "@ecs/contracts";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { usePermission } from "@/components/app/access-context";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogFooterActions,
  DialogFooterLeading,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/i18n/provider";
import { createClientId } from "@/lib/client-id";

export type ReturnReceiptPayload = {
  items: Array<{
    damagedQuantity: number;
    lineItemId: string;
    sellableQuantity: number;
  }>;
};

export function getReceivableReturnItems(order: MerchantOrder, orderReturn: MerchantOrderReturn) {
  const orderItems = new Map((order.items ?? []).map((item) => [item.id, item]));
  return orderReturn.items.flatMap((item) => {
    const maximum = Math.max(0, item.quantity - item.receivedQuantity - item.damagedQuantity);
    const orderItem = orderItems.get(item.lineItemId);
    return maximum > 0 && orderItem ? [{ item: orderItem, maximum }] : [];
  });
}

export function ReceiveReturnAction({
  action,
  order,
  orderReturn,
}: {
  action: string;
  order: MerchantOrder;
  orderReturn: MerchantOrderReturn;
}) {
  const canUpdate = usePermission("orders.update");
  const router = useRouter();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [quantities, setQuantities] = useState<
    Record<string, { damaged: number; sellable: number }>
  >({});
  const [error, setError] = useState<string | null>(null);
  const idempotencyRef = useRef<{ fingerprint: string; key: string } | null>(null);
  const receivable = useMemo(
    () => getReceivableReturnItems(order, orderReturn),
    [order, orderReturn],
  );

  useEffect(() => {
    if (!open) return;
    setError(null);
    setQuantities({});
  }, [open]);

  const selected = receivable.flatMap(({ item, maximum }) => {
    const value = quantities[item.id] ?? { damaged: 0, sellable: 0 };
    return Number.isInteger(value.sellable) &&
      Number.isInteger(value.damaged) &&
      value.sellable >= 0 &&
      value.damaged >= 0 &&
      value.sellable + value.damaged > 0 &&
      value.sellable + value.damaged <= maximum
      ? [
          {
            damagedQuantity: value.damaged,
            lineItemId: item.id,
            sellableQuantity: value.sellable,
          },
        ]
      : [];
  });
  const invalid = receivable.some(({ item, maximum }) => {
    const value = quantities[item.id] ?? { damaged: 0, sellable: 0 };
    return (
      !Number.isInteger(value.sellable) ||
      !Number.isInteger(value.damaged) ||
      value.sellable < 0 ||
      value.damaged < 0 ||
      value.sellable + value.damaged > maximum
    );
  });

  const mutation = useMutation({
    mutationFn: async (payload: ReturnReceiptPayload) => {
      const fingerprint = JSON.stringify(payload);
      if (idempotencyRef.current?.fingerprint !== fingerprint) {
        idempotencyRef.current = { fingerprint, key: createClientId("receive-return") };
      }
      const returnBase = action.replace("/actions/", "/returns/");
      const response = await fetch(`${returnBase}/${encodeURIComponent(orderReturn.id)}/receive`, {
        body: JSON.stringify(payload),
        headers: {
          "content-type": "application/json",
          "idempotency-key": idempotencyRef.current.key,
        },
        method: "POST",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof data?.error === "string" ? data.error : "order_return_receive_failed",
        );
      }
    },
    onError: (cause) => {
      setError(cause instanceof Error ? cause.message : "order_return_receive_failed");
    },
    onSuccess: () => {
      idempotencyRef.current = null;
      setError(null);
      setOpen(false);
      toast.success(t("orders.returns.receiveToast"));
      router.refresh();
    },
  });

  if (!canUpdate || receivable.length === 0) return null;

  return (
    <>
      <Button className="mt-2" onClick={() => setOpen(true)} size="sm" variant="outline">
        {t("orders.returns.receiveAction")}
      </Button>
      <Dialog open={open} onOpenChange={(next) => !mutation.isPending && setOpen(next)}>
        <DialogContent className="flex max-h-[min(92dvh,44rem)] flex-col gap-0 p-0 sm:max-w-xl">
          <DialogHeader className="shrink-0 gap-1.5 border-b px-4 py-4 text-left sm:px-5">
            <DialogTitle>{t("orders.returns.receiveTitle")}</DialogTitle>
            <DialogDescription>{t("orders.returns.receiveDescription")}</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 sm:p-5">
            {error ? (
              <Alert variant="destructive">
                <AlertTitle>{t("orders.actions.updateFailedTitle")}</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <div className="grid grid-cols-[minmax(0,1fr)_4.75rem_4.75rem] gap-2 px-3 text-xs font-medium text-muted-foreground">
              <span>{t("orders.returns.item")}</span>
              <span>{t("orders.returns.sellable")}</span>
              <span>{t("orders.returns.damaged")}</span>
            </div>
            {receivable.map(({ item, maximum }) => {
              const value = quantities[item.id] ?? { damaged: 0, sellable: 0 };
              const title = item.productTitle ?? item.title ?? t("orders.detail.fallbackItem");
              return (
                <div
                  className="grid grid-cols-[minmax(0,1fr)_4.75rem_4.75rem] items-center gap-2 rounded-lg border p-3"
                  key={item.id}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{title}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("orders.returns.expectedQuantity", { count: maximum })}
                    </p>
                  </div>
                  <Input
                    aria-label={t("orders.returns.sellableQuantityFor", { item: title })}
                    disabled={mutation.isPending}
                    inputMode="numeric"
                    max={maximum}
                    min={0}
                    onChange={(event) =>
                      setQuantities((current) => ({
                        ...current,
                        [item.id]: { ...value, sellable: Number(event.target.value) },
                      }))
                    }
                    type="number"
                    value={value.sellable}
                  />
                  <Input
                    aria-label={t("orders.returns.damagedQuantityFor", { item: title })}
                    disabled={mutation.isPending}
                    inputMode="numeric"
                    max={maximum}
                    min={0}
                    onChange={(event) =>
                      setQuantities((current) => ({
                        ...current,
                        [item.id]: { ...value, damaged: Number(event.target.value) },
                      }))
                    }
                    type="number"
                    value={value.damaged}
                  />
                </div>
              );
            })}
            <div className="rounded-lg bg-muted/40 px-3 py-2.5 text-sm leading-relaxed text-muted-foreground ring-1 ring-foreground/[0.06]">
              {t("orders.returns.receiveHelp")}
            </div>
          </div>
          <DialogFooter className="mx-0 mb-0 shrink-0 rounded-none border-t bg-muted/50 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <DialogFooterLeading>
              <Button
                disabled={mutation.isPending}
                onClick={() => setOpen(false)}
                type="button"
                variant="outline"
              >
                {t("common.cancel")}
              </Button>
            </DialogFooterLeading>
            <DialogFooterActions>
              <Button
                disabled={mutation.isPending || invalid || selected.length === 0}
                onClick={() => mutation.mutate({ items: selected })}
                type="button"
              >
                {mutation.isPending
                  ? t("orders.actions.working")
                  : t("orders.returns.receiveConfirm")}
              </Button>
            </DialogFooterActions>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
