"use client";

import type { MerchantExpenseCategory } from "@ecs/contracts";
import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";
import { usePermission } from "@/components/app/access-context";
import { AppIcons } from "@/components/app/icons";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogFooterActions,
  DialogFooterLeading,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/i18n/provider";
import { createClientId } from "@/lib/client-id";
import { dashboardRoutes } from "@/lib/routes";

export const expenseCategories: MerchantExpenseCategory[] = [
  "stock_supplies",
  "delivery_transport",
  "rent_utilities",
  "marketing",
  "fees",
  "wages",
  "tax",
  "other",
];

export function ExpenseCreateDialog() {
  const canManage = usePermission("settings.manage");
  const { t } = useI18n();
  const router = useRouter();
  const baseId = useId();
  const key = useRef(createClientId("expense"));
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<MerchantExpenseCategory>("stock_supplies");
  const [occurredOn, setOccurredOn] = useState(addisToday());
  const [vendorLabel, setVendorLabel] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");

  if (!canManage) return null;

  function reset() {
    setAmount("");
    setCategory("stock_supplies");
    setOccurredOn(addisToday());
    setVendorLabel("");
    setReference("");
    setNote("");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const minorAmount = Math.round(Number(amount) * 100);
    if (!Number.isInteger(minorAmount) || minorAmount <= 0 || minorAmount > 2_147_483_647) {
      toast.error(t("expenses.toast.createFailed"));
      return;
    }

    setPending(true);
    const response = await fetch(dashboardRoutes.expensesCreateAction, {
      body: JSON.stringify({
        amount: minorAmount,
        category,
        currencyCode: "etb",
        note: note.trim() || null,
        occurredOn,
        reference: reference.trim() || null,
        vendorLabel: vendorLabel.trim() || null,
      }),
      headers: { "content-type": "application/json", "idempotency-key": key.current },
      method: "POST",
    }).catch(() => null);
    setPending(false);
    if (!response?.ok) {
      toast.error(t("expenses.toast.createFailed"));
      return;
    }

    toast.success(t("expenses.toast.created"));
    key.current = createClientId("expense");
    setOpen(false);
    reset();
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <AppIcons.add data-icon="inline-start" />
          {t("expenses.add")}
        </Button>
      </DialogTrigger>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="gap-1.5 border-b px-4 py-4 pr-12 text-left sm:px-5">
          <DialogTitle>{t("expenses.form.title")}</DialogTitle>
          <DialogDescription>{t("expenses.form.description")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit}>
          <div className="grid max-h-[min(68dvh,38rem)] gap-4 overflow-y-auto px-4 py-5 sm:grid-cols-2 sm:px-5">
            <div className="grid gap-1.5">
              <Label htmlFor={`${baseId}-amount`}>{t("expenses.form.amount")}</Label>
              <Input
                autoFocus
                id={`${baseId}-amount`}
                inputMode="decimal"
                max="21474836.47"
                min="0.01"
                onChange={(event) => setAmount(event.target.value)}
                required
                step="0.01"
                value={amount}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`${baseId}-category`}>{t("expenses.form.category")}</Label>
              <Select
                onValueChange={(value) => setCategory(value as MerchantExpenseCategory)}
                value={category}
              >
                <SelectTrigger className="w-full rounded-md" id={`${baseId}-category`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="start">
                  {expenseCategories.map((value) => (
                    <SelectItem key={value} value={value}>
                      {t(`expenses.categories.${value}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`${baseId}-date`}>{t("expenses.form.date")}</Label>
              <DatePicker id={`${baseId}-date`} onChange={setOccurredOn} value={occurredOn} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`${baseId}-payee`}>{t("expenses.form.payee")}</Label>
              <Input
                id={`${baseId}-payee`}
                maxLength={160}
                onChange={(event) => setVendorLabel(event.target.value)}
                value={vendorLabel}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`${baseId}-reference`}>{t("expenses.form.reference")}</Label>
              <Input
                id={`${baseId}-reference`}
                maxLength={120}
                onChange={(event) => setReference(event.target.value)}
                value={reference}
              />
            </div>
            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor={`${baseId}-note`}>{t("expenses.form.note")}</Label>
              <Textarea
                id={`${baseId}-note`}
                maxLength={500}
                onChange={(event) => setNote(event.target.value)}
                rows={3}
                value={note}
              />
            </div>
          </div>
          <DialogFooter className="m-0 rounded-none border-t bg-muted/40 p-4">
            <DialogFooterLeading>
              <DialogClose asChild>
                <Button disabled={pending} type="button" variant="outline">
                  {t("common.cancel")}
                </Button>
              </DialogClose>
            </DialogFooterLeading>
            <DialogFooterActions>
              <Button disabled={pending || !amount || !occurredOn} type="submit">
                {pending ? t("expenses.form.saving") : t("expenses.form.save")}
              </Button>
            </DialogFooterActions>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function addisToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Addis_Ababa" }).format(new Date());
}
