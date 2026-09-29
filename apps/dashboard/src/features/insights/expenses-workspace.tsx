"use client";

import type { MerchantExpense, MerchantExpenseCategory } from "@ecs/contracts";
import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";
import { usePermission } from "@/components/app/access-context";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useI18n } from "@/i18n/provider";
import { createClientId } from "@/lib/client-id";

const categories: MerchantExpenseCategory[] = [
  "stock_supplies",
  "delivery_transport",
  "rent_utilities",
  "marketing",
  "fees",
  "wages",
  "tax",
  "other",
];

export function ExpensesWorkspace({
  expenses,
  totalAmount,
}: {
  expenses: MerchantExpense[];
  totalAmount: number;
}) {
  const { formatDate, formatNumber, t } = useI18n();
  const router = useRouter();
  const canManage = usePermission("settings.manage");
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const key = useRef(createClientId("expense"));
  const fieldId = useId();
  const ids = {
    amount: `${fieldId}-amount`,
    category: `${fieldId}-category`,
    date: `${fieldId}-date`,
    note: `${fieldId}-note`,
    vendor: `${fieldId}-vendor`,
  };

  async function submit(form: FormData) {
    const amount = Math.round(Number(form.get("amount")) * 100);
    setPending(true);
    const response = await fetch("/dashboard/insights/expenses/actions", {
      body: JSON.stringify({
        amount,
        category: form.get("category"),
        currencyCode: "etb",
        occurredOn: form.get("occurredOn"),
        vendorLabel: String(form.get("vendorLabel") ?? "").trim() || null,
        note: String(form.get("note") ?? "").trim() || null,
      }),
      headers: { "content-type": "application/json", "idempotency-key": key.current },
      method: "POST",
    }).catch(() => null);
    setPending(false);
    if (!response?.ok) {
      toast.error(t("insights.expenses.createFailed"));
      return;
    }
    toast.success(t("insights.expenses.created"));
    key.current = createClientId("expense");
    setOpen(false);
    router.refresh();
  }

  async function voidExpense(expenseId: string) {
    const response = await fetch(
      `/dashboard/insights/expenses/actions/${encodeURIComponent(expenseId)}/void`,
      { headers: { "idempotency-key": createClientId("expense-void") }, method: "POST" },
    ).catch(() => null);
    if (!response?.ok) return toast.error(t("insights.expenses.voidFailed"));
    toast.success(t("insights.expenses.voided"));
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="type-eyebrow">{t("insights.expenses.recordedTotal")}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {formatNumber(totalAmount / 100, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{" "}
            ETB
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{t("insights.expenses.totalHelp")}</p>
        </div>
        {canManage ? (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>{t("insights.expenses.add")}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogTitle>{t("insights.expenses.add")}</DialogTitle>
              <DialogDescription>{t("insights.expenses.addHelp")}</DialogDescription>
              <form action={submit} className="grid gap-4">
                <div className="grid gap-1.5">
                  <Label htmlFor={ids.amount}>{t("insights.expenses.amount")}</Label>
                  <Input
                    id={ids.amount}
                    name="amount"
                    inputMode="decimal"
                    min="0.01"
                    step="0.01"
                    required
                    autoFocus
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor={ids.category}>{t("insights.expenses.category")}</Label>
                  <select
                    id={ids.category}
                    name="category"
                    className="h-9 rounded-md border bg-background px-3 text-sm"
                    required
                  >
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {t(`insights.expenses.categories.${category}`)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor={ids.date}>{t("insights.expenses.date")}</Label>
                  <Input
                    id={ids.date}
                    name="occurredOn"
                    type="date"
                    defaultValue={new Date().toISOString().slice(0, 10)}
                    required
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor={ids.vendor}>{t("insights.expenses.vendor")}</Label>
                  <Input id={ids.vendor} name="vendorLabel" maxLength={160} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor={ids.note}>{t("insights.expenses.note")}</Label>
                  <Input id={ids.note} name="note" maxLength={500} />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={pending}>
                    {pending ? t("common.saving") : t("common.save")}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("insights.expenses.date")}</TableHead>
              <TableHead>{t("insights.expenses.category")}</TableHead>
              <TableHead>{t("insights.expenses.details")}</TableHead>
              <TableHead className="text-right">{t("insights.expenses.amount")}</TableHead>
              {canManage ? <TableHead /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.length ? (
              expenses.map((expense) => (
                <TableRow
                  key={expense.id}
                  className={expense.status === "void" ? "opacity-60" : undefined}
                >
                  <TableCell>{formatDate(expense.occurredOn)}</TableCell>
                  <TableCell>{t(`insights.expenses.categories.${expense.category}`)}</TableCell>
                  <TableCell className="max-w-64 truncate">
                    {expense.vendorLabel || expense.note || "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNumber(expense.amount / 100, { minimumFractionDigits: 2 })} ETB
                  </TableCell>
                  {canManage ? (
                    <TableCell className="text-right">
                      {expense.status === "active" ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void voidExpense(expense.id)}
                        >
                          {t("insights.expenses.void")}
                        </Button>
                      ) : (
                        t("insights.expenses.voidedLabel")
                      )}
                    </TableCell>
                  ) : null}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={canManage ? 5 : 4}
                  className="h-28 text-center text-muted-foreground"
                >
                  {t("insights.expenses.empty")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <p className="text-sm text-muted-foreground">{t("insights.expenses.disclaimer")}</p>
    </div>
  );
}
