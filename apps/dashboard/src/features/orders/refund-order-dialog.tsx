"use client";

import type { MerchantOrderRefundReason, MerchantOrderSettlementMethod } from "@ecs/contracts";
import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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

export type RefundOrderPayload = {
  amount: number;
  method: MerchantOrderSettlementMethod;
  reason: MerchantOrderRefundReason;
  reference?: string;
  note?: string;
};

const METHODS = ["cash", "telebirr", "cbe_birr", "bank_transfer", "chapa", "other"] as const;
const REASONS = [
  "customer_request",
  "item_unavailable",
  "wrong_item",
  "damaged_item",
  "duplicate_payment",
  "other",
] as const;

export function RefundOrderDialog({
  currencyCode,
  defaultMethod,
  maximum,
  onConfirm,
  onOpenChange,
  open,
  pending,
}: {
  currencyCode: string | null;
  defaultMethod: MerchantOrderSettlementMethod;
  maximum: number;
  onConfirm: (payload: RefundOrderPayload) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  pending: boolean;
}) {
  const { t } = useI18n();
  const amountId = useId();
  const noteId = useId();
  const referenceId = useId();
  const [amount, setAmount] = useState(String(maximum));
  const [method, setMethod] = useState<MerchantOrderSettlementMethod>(defaultMethod);
  const [reason, setReason] = useState<MerchantOrderRefundReason>("customer_request");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) return;
    setAmount(String(maximum));
    setMethod(defaultMethod);
    setReason("customer_request");
    setReference("");
    setNote("");
  }, [defaultMethod, maximum, open]);

  const numericAmount = Number(amount);
  const amountValid =
    Number.isFinite(numericAmount) && numericAmount > 0 && numericAmount <= maximum;

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className="flex max-h-[min(92dvh,42rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="shrink-0 gap-1.5 border-b px-4 py-4 text-left sm:px-5">
          <DialogTitle>{t("orders.refund.title")}</DialogTitle>
          <DialogDescription>{t("orders.refund.description")}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 sm:p-5">
          <Field data-invalid={amount.length > 0 && !amountValid}>
            <FieldLabel htmlFor={amountId}>{t("orders.refund.amount")}</FieldLabel>
            <div className="relative">
              <Input
                aria-invalid={amount.length > 0 && !amountValid}
                className="pr-14 font-mono tabular-nums"
                disabled={pending}
                id={amountId}
                inputMode="decimal"
                max={maximum}
                min="0.01"
                onChange={(event) => setAmount(event.target.value)}
                step="0.01"
                type="number"
                value={amount}
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-medium uppercase text-muted-foreground">
                {currencyCode ?? "ETB"}
              </span>
            </div>
            <FieldDescription>
              {t("orders.refund.available", { amount: maximum.toLocaleString() })}
            </FieldDescription>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel>{t("orders.refund.method")}</FieldLabel>
              <Select
                disabled={pending}
                onValueChange={(value) => setMethod(value as MerchantOrderSettlementMethod)}
                value={method}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METHODS.map((value) => (
                    <SelectItem key={value} value={value}>
                      {t(`orders.refund.methods.${value}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>{t("orders.refund.reason")}</FieldLabel>
              <Select
                disabled={pending}
                onValueChange={(value) => setReason(value as MerchantOrderRefundReason)}
                value={reason}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REASONS.map((value) => (
                    <SelectItem key={value} value={value}>
                      {t(`orders.refund.reasons.${value}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor={referenceId}>{t("orders.refund.reference")}</FieldLabel>
            <Input
              disabled={pending}
              id={referenceId}
              onChange={(event) => setReference(event.target.value)}
              placeholder={t("orders.refund.referencePlaceholder")}
              value={reference}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={noteId}>{t("orders.refund.note")}</FieldLabel>
            <Textarea
              disabled={pending}
              id={noteId}
              onChange={(event) => setNote(event.target.value)}
              placeholder={t("orders.refund.notePlaceholder")}
              rows={3}
              value={note}
            />
          </Field>
          <div className="rounded-lg bg-warning/10 px-3 py-2.5 text-sm leading-relaxed text-foreground ring-1 ring-warning/20">
            {t("orders.refund.confirmation")}
          </div>
        </div>
        <DialogFooter className="mx-0 mb-0 shrink-0 rounded-none border-t bg-muted/50 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button
            disabled={pending}
            onClick={() => onOpenChange(false)}
            type="button"
            variant="outline"
          >
            {t("common.cancel")}
          </Button>
          <Button
            disabled={pending || !amountValid}
            onClick={() =>
              onConfirm({
                amount: numericAmount,
                method,
                reason,
                ...(reference.trim() ? { reference: reference.trim() } : {}),
                ...(note.trim() ? { note: note.trim() } : {}),
              })
            }
            type="button"
          >
            {pending ? t("orders.actions.working") : t("orders.refund.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
