"use client";

import { useEffect, useMemo, useState } from "react";

import { AppIcons } from "@/components/app/icons";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

function SearchableOptionCombobox({
  disabled,
  emptyLabel,
  onChange,
  options,
  placeholder,
  searchPlaceholder,
  value,
}: {
  disabled?: boolean;
  emptyLabel: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string; keywords?: string }>;
  placeholder: string;
  searchPlaceholder: string;
  value: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value) ?? null;

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button
          aria-expanded={open}
          className={cn(
            "h-9 w-full justify-between px-3 font-normal shadow-none",
            !selected && "text-muted-foreground",
          )}
          disabled={disabled}
          role="combobox"
          type="button"
          variant="outline"
        >
          <span className="truncate">{selected ? selected.label : placeholder}</span>
          <AppIcons.arrowDown className="size-4 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] overflow-hidden p-0"
        collisionPadding={16}
        onWheel={(event) => event.stopPropagation()}
      >
        <Command className="h-auto max-h-72 w-full min-h-0">
          <CommandInput autoFocus placeholder={searchPlaceholder} />
          <CommandList
            className="max-h-60 min-h-0 overflow-y-auto overscroll-contain"
            onWheel={(event) => event.stopPropagation()}
          >
            <CommandEmpty>
              <span className="px-2 text-sm text-muted-foreground">{emptyLabel}</span>
            </CommandEmpty>
            <CommandGroup className="overflow-visible">
              <CommandItem
                data-checked={!value ? true : undefined}
                onSelect={() => {
                  onChange("");
                  setOpen(false);
                }}
                value="none clear"
              >
                <span className="truncate text-muted-foreground">{placeholder}</span>
              </CommandItem>
              {options.map((option) => {
                const isSelected = option.value === value;
                return (
                  <CommandItem
                    data-checked={isSelected ? true : undefined}
                    key={option.value}
                    onSelect={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    value={`${option.label} ${option.keywords ?? ""} ${option.value}`}
                  >
                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
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
      reference: reference.trim() || undefined,
      note: note.trim() || undefined,
    };
    if (selectedAccount) {
      payload.receivingAccountId = selectedAccount.id;
      payload.accountLabel = selectedAccount.label;
      payload.accountLast4 = selectedAccount.accountLast4 ?? undefined;
      payload.bankName = selectedAccount.bankName;
    } else if (bankCode) {
      const bank = banks.find((item) => item.code === bankCode);
      payload.bankCode = bankCode;
      payload.bankName = bank?.name;
    }
    onConfirm(payload);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="gap-1.5 border-b px-4 py-4 text-left sm:px-5">
          <DialogTitle>{title ?? t("orders.settlement.dialogTitle")}</DialogTitle>
          <DialogDescription>
            {description ?? t("orders.settlement.dialogDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[min(70dvh,28rem)] space-y-4 overflow-y-auto p-4 sm:p-5">
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
                  <SearchableOptionCombobox
                    disabled={pending}
                    emptyLabel={t("orders.settlement.noMatchingAccounts")}
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
                  <SearchableOptionCombobox
                    disabled={pending}
                    emptyLabel={t("orders.settlement.noMatchingBanks")}
                    onChange={setBankCode}
                    options={bankOptions}
                    placeholder={t("orders.settlement.bankNone")}
                    searchPlaceholder={t("orders.settlement.searchBanks")}
                    value={bankCode}
                  />
                </Field>
              ) : null}

              {method !== "cash" ? (
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
              ) : null}

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
        <DialogFooter className="mx-0 mb-0 rounded-none border-t bg-muted/50 p-4">
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
