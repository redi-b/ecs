"use client";

import { useEffect, useMemo, useState } from "react";

import { SearchableCombobox } from "@/components/app/searchable-combobox";
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
import type { MessageKey } from "@/i18n/messages";
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

const METHODS: Array<{
  id: SettlementMethodUi;
  titleKey: MessageKey;
  descriptionKey: MessageKey;
}> = [
  { id: "cash", titleKey: "orders.settlement.cash", descriptionKey: "orders.settlement.cashDesc" },
  {
    id: "telebirr",
    titleKey: "orders.settlement.telebirr",
    descriptionKey: "orders.settlement.telebirrDesc",
  },
  {
    id: "cbe_birr",
    titleKey: "orders.settlement.cbeBirr",
    descriptionKey: "orders.settlement.cbeBirrDesc",
  },
  {
    id: "bank_transfer",
    titleKey: "orders.settlement.bankTransfer",
    descriptionKey: "orders.settlement.bankTransferDesc",
  },
  {
    id: "other",
    titleKey: "orders.settlement.other",
    descriptionKey: "orders.settlement.otherDesc",
  },
];

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
    setReceivingAccountId(accounts.find((account) => account.isDefault)?.id ?? "");
    setBankCode("");
    setReference("");
    setNote("");
  }, [open, accounts]);

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === receivingAccountId) ?? null,
    [accounts, receivingAccountId],
  );

  const selectedMethod = METHODS.find((item) => item.id === method);
  const showExtras =
    method === "bank_transfer" ||
    method === "telebirr" ||
    method === "cbe_birr" ||
    method === "other";

  const bankOptions = useMemo(
    () => banks.map((bank) => ({ value: bank.code, label: bank.name, keywords: bank.code })),
    [banks],
  );

  const accountOptions = useMemo(
    () =>
      accounts.map((account) => ({
        value: account.id,
        label: account.accountLast4
          ? `${account.label} ···${account.accountLast4}`
          : account.label,
        keywords: `${account.bankName} ${account.accountLast4 ?? ""}`,
      })),
    [accounts],
  );

  function submit() {
    const payload: MarkPaidSettlementPayload = {
      settlementMethod: method,
    };
    const trimmedReference = reference.trim();
    if (trimmedReference) payload.reference = trimmedReference;
    const trimmedNote = note.trim();
    if (trimmedNote) payload.note = trimmedNote;
    if (selectedAccount) {
      payload.receivingAccountId = selectedAccount.id;
      payload.accountLabel = selectedAccount.label;
      if (selectedAccount.accountLast4) payload.accountLast4 = selectedAccount.accountLast4;
      payload.bankName = selectedAccount.bankName;
    } else if (bankCode) {
      const bank = banks.find((item) => item.code === bankCode);
      payload.bankCode = bankCode;
      if (bank?.name) payload.bankName = bank.name;
    }
    onConfirm(payload);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(92dvh,40rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="shrink-0 gap-1.5 border-b px-4 py-4 text-left sm:px-5">
          <DialogTitle>{title ?? t("orders.settlement.dialogTitle")}</DialogTitle>
          <DialogDescription>
            {description ?? t("orders.settlement.dialogDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 sm:p-5">
          <div className="space-y-2">
            <p className="text-sm font-medium">{t("orders.settlement.paymentMethod")}</p>
            <div className="grid grid-cols-2 gap-1.5">
              {METHODS.map((option) => {
                const selected = method === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    disabled={pending}
                    aria-pressed={selected}
                    onClick={() => setMethod(option.id)}
                    className={cn(
                      "rounded-lg border px-2.5 py-2 text-left text-sm font-medium transition-colors outline-none",
                      "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                      selected
                        ? "border-primary bg-primary/5 text-foreground"
                        : "text-muted-foreground hover:border-border hover:bg-muted/40 hover:text-foreground",
                      option.id === "other" ? "col-span-2 sm:col-span-1" : "",
                    )}
                  >
                    {t(option.titleKey)}
                  </button>
                );
              })}
            </div>
            {selectedMethod ? (
              <p className="text-xs text-muted-foreground">{t(selectedMethod.descriptionKey)}</p>
            ) : null}
          </div>

          {showExtras ? (
            <div className="space-y-3">
              {accounts.length > 0 ? (
                <Field>
                  <FieldLabel>{t("orders.settlement.receivingAccount")}</FieldLabel>
                  <SearchableCombobox
                    disabled={pending}
                    emptyLabel={t("orders.settlement.noMatchingAccounts")}
                    noneLabel={t("orders.settlement.receivingAccountNone")}
                    onChange={setReceivingAccountId}
                    options={accountOptions}
                    placeholder={t("orders.settlement.receivingAccountNone")}
                    searchPlaceholder={t("orders.settlement.searchAccounts")}
                    value={receivingAccountId}
                  />
                  <FieldDescription>
                    {t("orders.settlement.receivingAccountHint")}
                  </FieldDescription>
                </Field>
              ) : null}

              {!selectedAccount && banks.length > 0 && method === "bank_transfer" ? (
                <Field>
                  <FieldLabel>{t("orders.settlement.bank")}</FieldLabel>
                  <SearchableCombobox
                    disabled={pending}
                    emptyLabel={t("orders.settlement.noMatchingBanks")}
                    noneLabel={t("orders.settlement.bankNone")}
                    onChange={setBankCode}
                    options={bankOptions}
                    placeholder={t("orders.settlement.bankNone")}
                    searchPlaceholder={t("orders.settlement.searchBanks")}
                    value={bankCode}
                  />
                </Field>
              ) : null}

              <Field>
                <FieldLabel>{t("orders.settlement.reference")}</FieldLabel>
                <Input
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                  placeholder={t("orders.settlement.referencePlaceholder")}
                  disabled={pending}
                />
                <FieldDescription>{t("orders.settlement.referenceHint")}</FieldDescription>
              </Field>

              {method === "other" ? (
                <Field>
                  <FieldLabel>{t("orders.settlement.note")}</FieldLabel>
                  <Input
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder={t("orders.settlement.notePlaceholder")}
                    disabled={pending}
                  />
                </Field>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* p-0 content: cancel DialogFooter negative margins (same as create dialogs). */}
        <DialogFooter className="mx-0 mb-0 shrink-0 rounded-none border-t bg-muted/50 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            {t("common.cancel")}
          </Button>
          <Button type="button" disabled={pending} onClick={submit}>
            {pending
              ? t("orders.actions.working")
              : (confirmLabel ?? t("orders.settlement.confirmPaid"))}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
