"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";

export type SettlementMethodUi =
  | "cash"
  | "telebirr"
  | "cbe_birr"
  | "bank_transfer"
  | "other";

export type MarkPaidSettlementPayload = {
  settlementMethod: SettlementMethodUi;
  bankCode?: string;
  bankName?: string;
  accountLast4?: string;
  accountLabel?: string;
  receivingAccountId?: string;
  reference?: string;
  note?: string;
};

export type ReceivingAccountOption = {
  id: string;
  label: string;
  bankName: string;
  accountLast4: string | null;
  isDefault: boolean;
};

export type BankOption = {
  code: string;
  name: string;
};

type MarkPaidDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending: boolean;
  accounts?: ReceivingAccountOption[];
  banks?: BankOption[];
  title?: string;
  description?: string;
  confirmLabel?: string;
  onConfirm: (payload: MarkPaidSettlementPayload) => void;
};

const METHODS: SettlementMethodUi[] = [
  "cash",
  "telebirr",
  "cbe_birr",
  "bank_transfer",
  "other",
];

function methodLabelKey(method: SettlementMethodUi) {
  switch (method) {
    case "cash":
      return "orders.settlement.cash" as const;
    case "telebirr":
      return "orders.settlement.telebirr" as const;
    case "cbe_birr":
      return "orders.settlement.cbeBirr" as const;
    case "bank_transfer":
      return "orders.settlement.bankTransfer" as const;
    case "other":
      return "orders.settlement.other" as const;
  }
}

export function MarkPaidDialog({
  open,
  onOpenChange,
  pending,
  accounts = [],
  banks = [],
  title,
  description,
  confirmLabel,
  onConfirm,
}: MarkPaidDialogProps) {
  const { t } = useI18n();
  const [method, setMethod] = useState<SettlementMethodUi>("cash");
  const [receivingAccountId, setReceivingAccountId] = useState<string>("");
  const [bankCode, setBankCode] = useState<string>("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) return;
    setMethod("cash");
    setReceivingAccountId(accounts.find((a) => a.isDefault)?.id ?? "");
    setBankCode("");
    setReference("");
    setNote("");
  }, [open, accounts]);

  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === receivingAccountId) ?? null,
    [accounts, receivingAccountId],
  );

  const needsBankDetail = method === "bank_transfer" || method === "telebirr" || method === "cbe_birr";

  function submit() {
    const payload: MarkPaidSettlementPayload = {
      settlementMethod: method,
      reference: reference.trim() || undefined,
      note: note.trim() || undefined,
    };
    if (selectedAccount) {
      payload.receivingAccountId = selectedAccount.id;
      payload.accountLabel = selectedAccount.label;
      payload.accountLast4 = selectedAccount.accountLast4 ?? undefined;
      payload.bankName = selectedAccount.bankName;
    } else if (bankCode) {
      const bank = banks.find((b) => b.code === bankCode);
      payload.bankCode = bankCode;
      payload.bankName = bank?.name;
    }
    onConfirm(payload);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="border-b border-border/60 px-5 py-4 text-left">
          <DialogTitle>{title ?? t("orders.settlement.dialogTitle")}</DialogTitle>
          <DialogDescription>
            {description ?? t("orders.settlement.dialogDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 px-5 py-4">
          <div>
            <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {t("orders.settlement.howReceived")}
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {METHODS.map((item) => {
                const active = method === item;
                return (
                  <button
                    key={item}
                    type="button"
                    disabled={pending}
                    onClick={() => setMethod(item)}
                    className={cn(
                      "rounded-xl border px-3 py-2.5 text-left text-sm transition-colors",
                      active
                        ? "border-primary bg-primary/10 font-medium text-foreground shadow-sm"
                        : "border-border/80 bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
                      item === "cash" && !active ? "ring-1 ring-primary/15" : "",
                    )}
                  >
                    {t(methodLabelKey(item))}
                    {item === "cash" ? (
                      <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">
                        {t("orders.settlement.cashHint")}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          {needsBankDetail && accounts.length > 0 ? (
            <Field>
              <FieldLabel>{t("orders.settlement.receivingAccount")}</FieldLabel>
              <Select
                value={receivingAccountId || "__none__"}
                onValueChange={(value) => setReceivingAccountId(value === "__none__" ? "" : value)}
                disabled={pending}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("orders.settlement.receivingAccountOptional")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t("orders.settlement.skipAccount")}</SelectItem>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.label}
                      {account.accountLast4 ? ` ···${account.accountLast4}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : null}

          {needsBankDetail && !selectedAccount && banks.length > 0 ? (
            <Field>
              <FieldLabel>{t("orders.settlement.bankOptional")}</FieldLabel>
              <Select
                value={bankCode || "__none__"}
                onValueChange={(value) => setBankCode(value === "__none__" ? "" : value)}
                disabled={pending}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("orders.settlement.bankOptional")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t("orders.settlement.skipBank")}</SelectItem>
                  {banks.map((bank) => (
                    <SelectItem key={bank.code} value={bank.code}>
                      {bank.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : null}

          {method !== "cash" ? (
            <Field>
              <FieldLabel>{t("orders.settlement.referenceOptional")}</FieldLabel>
              <Input
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                placeholder={t("orders.settlement.referencePlaceholder")}
                disabled={pending}
              />
            </Field>
          ) : null}

          {method === "other" ? (
            <Field>
              <FieldLabel>{t("orders.settlement.noteOptional")}</FieldLabel>
              <Input
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder={t("orders.settlement.notePlaceholder")}
                disabled={pending}
              />
            </Field>
          ) : null}
        </div>

        <DialogFooter className="gap-2 border-t border-border/60 bg-muted/30 px-5 py-3 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            {t("common.cancel")}
          </Button>
          <Button type="button" disabled={pending} onClick={submit}>
            {confirmLabel ??
              (method === "cash"
                ? t("orders.settlement.confirmCash")
                : t("orders.settlement.confirmPaid"))}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
