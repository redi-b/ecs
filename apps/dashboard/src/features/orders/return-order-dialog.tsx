"use client";

import type { MerchantOrder } from "@ecs/contracts";
import { useEffect, useId, useMemo, useState } from "react";
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
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/i18n/provider";

export type ReturnOrderPayload = {
  items: Array<{ lineItemId: string; quantity: number }>;
  note?: string;
};

export function getReturnableOrderItems(order: MerchantOrder) {
  const committed = new Map<string, number>();
  for (const orderReturn of order.returns ?? []) {
    if (orderReturn.canceledAt || orderReturn.status?.toLowerCase().includes("cancel")) continue;
    for (const item of orderReturn.items) {
      committed.set(item.lineItemId, (committed.get(item.lineItemId) ?? 0) + item.quantity);
    }
  }
  return (order.items ?? []).flatMap((item) => {
    const maximum = Math.max(0, (item.quantity ?? 0) - (committed.get(item.id) ?? 0));
    return maximum > 0 ? [{ item, maximum }] : [];
  });
}

export function ReturnOrderDialog({
  onConfirm,
  onOpenChange,
  open,
  order,
  pending,
}: {
  onConfirm: (payload: ReturnOrderPayload) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  order: MerchantOrder;
  pending: boolean;
}) {
  const { t } = useI18n();
  const noteId = useId();
  const returnable = useMemo(() => getReturnableOrderItems(order), [order]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [arrangement, setArrangement] = useState("shop_dropoff");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) return;
    setQuantities({});
    setArrangement("shop_dropoff");
    setNote("");
  }, [open]);

  const selected = returnable.flatMap(({ item, maximum }) => {
    const quantity = quantities[item.id] ?? 0;
    return Number.isInteger(quantity) && quantity > 0 && quantity <= maximum
      ? [{ lineItemId: item.id, quantity }]
      : [];
  });
  const invalid = returnable.some(({ item, maximum }) => {
    const quantity = quantities[item.id] ?? 0;
    return !Number.isInteger(quantity) || quantity < 0 || quantity > maximum;
  });
  const arrangementLabel =
    arrangement === "merchant_pickup"
      ? t("orders.returns.arrangements.merchant_pickup")
      : arrangement === "other"
        ? t("orders.returns.arrangements.other")
        : t("orders.returns.arrangements.shop_dropoff");

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className="flex max-h-[min(92dvh,44rem)] flex-col gap-0 p-0 sm:max-w-lg">
        <DialogHeader className="shrink-0 gap-1.5 border-b px-4 py-4 text-left sm:px-5">
          <DialogTitle>{t("orders.returns.createTitle")}</DialogTitle>
          <DialogDescription>{t("orders.returns.createDescription")}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-4 sm:p-5">
          <div className="space-y-2">
            {returnable.map(({ item, maximum }) => (
              <div
                className="grid grid-cols-[minmax(0,1fr)_5rem] items-center gap-3 rounded-lg border p-3"
                key={item.id}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {item.productTitle ?? item.title ?? t("orders.detail.fallbackItem")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("orders.returns.availableQuantity", { count: maximum })}
                  </p>
                </div>
                <Input
                  aria-label={t("orders.returns.quantityFor", {
                    item: item.productTitle ?? item.title ?? t("orders.detail.fallbackItem"),
                  })}
                  disabled={pending}
                  inputMode="numeric"
                  max={maximum}
                  min={0}
                  onChange={(event) =>
                    setQuantities((current) => ({
                      ...current,
                      [item.id]: Number(event.target.value),
                    }))
                  }
                  type="number"
                  value={quantities[item.id] ?? 0}
                />
              </div>
            ))}
          </div>
          <Field>
            <FieldLabel>{t("orders.returns.arrangement")}</FieldLabel>
            <Select disabled={pending} onValueChange={setArrangement} value={arrangement}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="shop_dropoff">{t("orders.returns.shopDropoff")}</SelectItem>
                <SelectItem value="merchant_pickup">
                  {t("orders.returns.merchantPickup")}
                </SelectItem>
                <SelectItem value="other">{t("orders.returns.otherArrangement")}</SelectItem>
              </SelectContent>
            </Select>
            <FieldDescription>{t("orders.returns.arrangementHelp")}</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor={noteId}>{t("orders.returns.note")}</FieldLabel>
            <Textarea
              disabled={pending}
              id={noteId}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              value={note}
            />
          </Field>
          <div className="rounded-lg bg-muted/40 px-3 py-2.5 text-sm leading-relaxed text-muted-foreground ring-1 ring-foreground/[0.06]">
            {t("orders.returns.moneySeparate")}
          </div>
        </div>
        <DialogFooter className="mx-0 mb-0 shrink-0 rounded-none border-t bg-muted/50 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <DialogFooterLeading>
            <Button
              disabled={pending}
              onClick={() => onOpenChange(false)}
              type="button"
              variant="outline"
            >
              {t("common.cancel")}
            </Button>
          </DialogFooterLeading>
          <DialogFooterActions>
            <Button
              disabled={pending || invalid || selected.length === 0}
              onClick={() =>
                onConfirm({
                  items: selected,
                  note: [arrangementLabel, note.trim()].filter(Boolean).join(" — "),
                })
              }
              type="button"
            >
              {pending ? t("orders.actions.working") : t("orders.returns.confirm")}
            </Button>
          </DialogFooterActions>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
