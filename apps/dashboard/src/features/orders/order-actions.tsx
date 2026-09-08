"use client";

import type { MerchantOrder } from "@ecs/contracts";
import { RiMore2Fill } from "@remixicon/react";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { type BankOption, MarkPaidDialog, type MarkPaidSettlementPayload, type ReceivingAccountOption } from "@/features/orders/mark-paid-dialog";
import { canMarkPaid, canRecheckPayment, getNextAction, type OrderNextActionType } from "@/features/orders/order-domain";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/provider";

type PendingKind = { kind: "next"; type: OrderNextActionType } | { kind: "complete_remaining" } | { kind: "recheck" } | { kind: "cancel" };
type Translate = (key: MessageKey, values?: Record<string, string | number | Date>) => string;

function mapActionError(message: string, t: Translate) {
  if (message === "order_not_fulfillable") return t("orders.actions.errFulfillable");
  if (message === "order_fulfillment_not_found") return t("orders.actions.errFulfillmentNotFound");
  if (message === "inventory_location_unavailable") return t("orders.actions.errInventory");
  if (message === "order_not_found") return t("orders.actions.errNotFound");
  if (message === "order_not_cancelable") return t("orders.actions.errNotCancelable");
  if (message === "order_refund_required") return t("orders.actions.errRefundRequired");
  return message || t("orders.actions.errGeneric");
}

function nextActionCopy(type: OrderNextActionType, t: Translate) {
  const values: Record<OrderNextActionType, { label: MessageKey; description: MessageKey }> = {
    mark_out_for_delivery: { label: "orders.actions.markOutForDelivery", description: "orders.actions.markOutForDeliveryDesc" },
    mark_ready_for_pickup: { label: "orders.actions.markReadyForPickup", description: "orders.actions.markReadyForPickupDesc" },
    mark_delivered: { label: "orders.actions.markDelivered", description: "orders.actions.markDeliveredDesc" },
    mark_picked_up: { label: "orders.actions.markPickedUp", description: "orders.actions.markPickedUpDesc" },
    mark_ready: { label: "orders.actions.markReady", description: "orders.actions.markReadyDesc" },
    mark_completed: { label: "orders.actions.markCompleted", description: "orders.actions.markCompletedDesc" },
    none: { label: "orders.actions.allDone", description: "orders.actions.allDoneDesc" },
  };
  return { label: t(values[type].label), description: t(values[type].description) };
}

async function postOrderAction(actionUrl: string, body: Record<string, unknown>) {
  const response = await fetch(actionUrl, { body: JSON.stringify(body), headers: { "content-type": "application/json" }, method: "POST" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data?.message === "string" ? data.message : typeof data?.error === "string" ? data.error : "order_action_failed");
  return (data?.data?.order ?? data?.order) as MerchantOrder;
}

async function advanceOrder(actionUrl: string, current: MerchantOrder, type: OrderNextActionType) {
  if (["mark_ready_for_pickup", "mark_ready"].includes(type)) return postOrderAction(actionUrl, { action: "fulfill" });
  if (type === "mark_out_for_delivery") {
    let updated = current;
    const openFulfillments = () => (updated.fulfillments ?? []).filter(
      (value) => !value.shippedAt && !value.deliveredAt && !value.canceledAt,
    );
    if (!openFulfillments().length) {
      updated = await postOrderAction(actionUrl, { action: "fulfill" });
    }
    for (const item of openFulfillments()) {
      updated = await postOrderAction(actionUrl, { action: "ship", fulfillmentId: item.id });
    }
    return updated;
  }
  if (["mark_delivered", "mark_picked_up", "mark_completed"].includes(type)) {
    for (const item of (current.fulfillments ?? []).filter((value) => !value.deliveredAt && !value.canceledAt)) {
      await postOrderAction(actionUrl, { action: "deliver", fulfillmentId: item.id });
    }
    return postOrderAction(actionUrl, { action: "complete" });
  }
  return current;
}

export function OrderActions({ action, order, variant = "card" }: { action: string; order: MerchantOrder; variant?: "card" | "header" }) {
  const { t } = useI18n();
  const router = useRouter();
  const next = useMemo(() => getNextAction(order), [order]);
  const copy = nextActionCopy(next.type, t);
  const [pending, setPending] = useState<PendingKind | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [markPaidOpen, setMarkPaidOpen] = useState(false);
  const [accounts, setAccounts] = useState<ReceivingAccountOption[]>([]);
  const [banks, setBanks] = useState<BankOption[]>([]);

  useEffect(() => {
    void Promise.all([fetch("/admin/settings/payments/receiving-accounts", { cache: "no-store" }), fetch("/admin/settings/payments/banks", { cache: "no-store" })]).then(async ([a, b]) => {
      if (a.ok) setAccounts((await a.json().catch(() => ({})))?.accounts ?? []);
      if (b.ok) setBanks((await b.json().catch(() => ({})))?.banks ?? []);
    }).catch(() => undefined);
  }, []);

  const mutation = useMutation({
    mutationFn: async (kind: PendingKind) => {
      if (kind.kind === "next") { await advanceOrder(action, order, kind.type); return t("orders.actions.toastDone"); }
      if (kind.kind === "complete_remaining") {
        await postOrderAction(action, { action: "finish" });
        return t("orders.actions.toastFinished");
      }
      if (kind.kind === "recheck") { await postOrderAction(action, { action: "recheck-payment" }); return t("orders.actions.toastRecheck"); }
      await postOrderAction(action, { action: "cancel" }); return t("orders.actions.toastCanceled");
    },
    onError: (error) => setActionError(mapActionError(error instanceof Error ? error.message : "order_action_failed", t)),
    onSuccess: (message) => { setActionError(null); setPending(null); toast.success(message); router.refresh(); },
  });
  const markPaidMutation = useMutation({
    mutationFn: async (payload: MarkPaidSettlementPayload) => { await postOrderAction(action, { action: "mark-paid", ...payload }); return t("orders.actions.toastPaid"); },
    onError: (error) => setActionError(mapActionError(error instanceof Error ? error.message : "order_action_failed", t)),
    onSuccess: (message) => { setActionError(null); setMarkPaidOpen(false); toast.success(message); router.refresh(); },
  });

  const showMarkPaid = canMarkPaid(order);
  const showRecheck = canRecheckPayment(order);
  const canceled = (order.status ?? "").toLowerCase().includes("cancel");
  const showCancel = !canceled && (next.type !== "none" || showMarkPaid);
  const hasMenu = next.type !== "none" || showMarkPaid || showRecheck || showCancel;
  const menu = hasMenu ? <DropdownMenu><DropdownMenuTrigger asChild><Button aria-label={t("orders.actions.moreActions")} disabled={mutation.isPending} size="icon" type="button" variant="outline"><RiMore2Fill className="size-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-56">
    {next.type !== "none" ? <DropdownMenuItem onSelect={() => setPending({ kind: "complete_remaining" })}>{t("orders.actions.completeAll")}</DropdownMenuItem> : null}
    {showMarkPaid ? <DropdownMenuItem onSelect={() => setMarkPaidOpen(true)}>{t("orders.actions.markPaid")}</DropdownMenuItem> : null}
    {showRecheck ? <DropdownMenuItem onSelect={() => setPending({ kind: "recheck" })}>{t("orders.actions.recheckPayment")}</DropdownMenuItem> : null}
    {showCancel ? <><DropdownMenuSeparator /><DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setPending({ kind: "cancel" })}>{t("orders.actions.cancelOrder")}</DropdownMenuItem></> : null}
  </DropdownMenuContent></DropdownMenu> : null;

  if (next.type === "none" && !hasMenu) return <div className="rounded-xl bg-muted/30 px-3.5 py-3 text-sm text-muted-foreground ring-1 ring-foreground/[0.06]">{canceled ? t("orders.actions.canceled") : t("orders.actions.noFurther")}</div>;

  return <div className={variant === "card" ? "flex h-full flex-col gap-3" : "space-y-3"}>
    {actionError ? <Alert variant="destructive"><AlertTitle>{t("orders.actions.updateFailedTitle")}</AlertTitle><AlertDescription>{actionError}</AlertDescription></Alert> : null}
    <div className={variant === "header" ? "flex items-center gap-2" : "flex h-full min-h-[11rem] flex-col gap-3"}>
      {next.type !== "none" ? <div className={variant === "card" ? "flex flex-1 flex-col gap-4 rounded-xl bg-primary/[0.07] p-4 ring-1 ring-primary/20" : "contents"}>
        {variant === "card" ? <div className="space-y-1.5"><p className="text-xs font-medium text-primary">{t("orders.actions.next")}</p><p className="text-base font-semibold">{copy.label}</p><p className="text-sm leading-relaxed text-muted-foreground">{copy.description}</p></div> : null}
        <div className={variant === "card" ? "mt-auto flex items-center gap-2" : "contents"}><Button className={variant === "card" ? "flex-1" : undefined} disabled={mutation.isPending || markPaidMutation.isPending} onClick={() => setPending({ kind: "next", type: next.type })}>{copy.label}</Button>{menu}</div>
      </div> : <div className="ml-auto">{menu}</div>}
    </div>
    <MarkPaidDialog open={markPaidOpen} onOpenChange={setMarkPaidOpen} pending={markPaidMutation.isPending} accounts={accounts} banks={banks} onConfirm={(payload) => markPaidMutation.mutate(payload)} />
    <AlertDialog open={pending !== null} onOpenChange={(open) => { if (!open && !mutation.isPending) setPending(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{pending?.kind === "cancel" ? t("orders.actions.confirmCancelTitle") : pending?.kind === "complete_remaining" ? t("orders.actions.confirmFinishTitle") : pending?.kind === "recheck" ? t("orders.actions.confirmRecheckTitle") : copy.label}</AlertDialogTitle><AlertDialogDescription>{pending?.kind === "cancel" ? t("orders.actions.confirmCancelBody") : pending?.kind === "complete_remaining" ? t("orders.actions.completeAllExcludesPayment") : pending?.kind === "recheck" ? t("orders.actions.confirmRecheckBody") : copy.description}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={mutation.isPending}>{t("common.back")}</AlertDialogCancel><AlertDialogAction disabled={mutation.isPending || !pending} onClick={(event) => { event.preventDefault(); if (pending) mutation.mutate(pending); }} variant={pending?.kind === "cancel" ? "destructive" : "default"}>{mutation.isPending ? t("orders.actions.working") : pending?.kind === "cancel" ? t("orders.actions.yesCancel") : t("orders.actions.confirm")}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}
