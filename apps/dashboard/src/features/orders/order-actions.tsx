"use client";

import type { MerchantOrder } from "@ecs/contracts";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { HelpTip } from "@/components/app/help-tip";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  canMarkPaid,
  canRecheckPayment,
  getNextAction,
  getRemainingFinishSteps,
  type OrderNextActionType,
} from "@/features/orders/order-domain";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/provider";

type PendingKind =
  | { kind: "next"; type: OrderNextActionType }
  | { kind: "finish" }
  | { kind: "mark_paid" }
  | { kind: "recheck" }
  | { kind: "cancel" };

type OrderActionsProps = {
  action: string;
  order: MerchantOrder;
  /** Compact layout for sticky header */
  variant?: "card" | "header";
};

type Translate = (key: MessageKey, values?: Record<string, string | number | Date>) => string;

function mapActionError(message: string, t: Translate) {
  switch (message) {
    case "order_not_fulfillable":
      return t("orders.actions.errFulfillable");
    case "order_fulfillment_not_found":
      return t("orders.actions.errFulfillmentNotFound");
    case "inventory_location_unavailable":
      return t("orders.actions.errInventory");
    case "order_not_found":
      return t("orders.actions.errNotFound");
    default:
      return message || t("orders.actions.errGeneric");
  }
}

function nextActionCopy(type: OrderNextActionType, t: Translate) {
  switch (type) {
    case "mark_ready":
      return { label: t("orders.actions.markReady"), description: t("orders.actions.markReadyDesc") };
    case "mark_completed":
      return {
        label: t("orders.actions.markCompleted"),
        description: t("orders.actions.markCompletedDesc"),
      };
    case "mark_paid":
      return { label: t("orders.actions.markPaid"), description: t("orders.actions.markPaidDesc") };
    case "none":
    default:
      return { label: t("orders.actions.allDone"), description: t("orders.actions.allDoneDesc") };
  }
}

function finishStepLabel(id: string, t: Translate) {
  switch (id) {
    case "ready":
      return t("orders.actions.stepReady");
    case "completed":
      return t("orders.actions.stepCompleted");
    case "paid":
      return t("orders.actions.stepPaid");
    default:
      return id;
  }
}

async function postOrderAction(
  actionUrl: string,
  body: Record<string, unknown>,
): Promise<MerchantOrder> {
  const response = await fetch(actionUrl, {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof data?.message === "string"
        ? data.message
        : typeof data?.error === "string"
          ? data.error
          : "order_action_failed",
    );
  }
  return data?.data?.order ?? data?.order;
}

export function OrderActions({ action, order, variant = "card" }: OrderActionsProps) {
  const { t } = useI18n();
  const router = useRouter();
  const next = useMemo(() => getNextAction(order), [order]);
  const nextCopy = nextActionCopy(next.type, t);
  const [pending, setPending] = useState<PendingKind | null>(null);
  const [finishIncludePaid, setFinishIncludePaid] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);

  const finishSteps = useMemo(
    () => getRemainingFinishSteps(order, { includeMarkPaid: finishIncludePaid }),
    [order, finishIncludePaid],
  );

  const mutation = useMutation({
    mutationFn: async (kind: PendingKind) => {
      if (kind.kind === "next") {
        if (kind.type === "mark_ready") {
          await postOrderAction(action, { action: "fulfill" });
          return t("orders.actions.toastReady");
        }
        if (kind.type === "mark_completed") {
          const open = (order.fulfillments ?? []).filter(
            (item) => !item.deliveredAt && !item.canceledAt,
          );
          for (const fulfillment of open) {
            await postOrderAction(action, {
              action: "deliver",
              fulfillmentId: fulfillment.id,
            });
          }
          if (open.length === 0) {
            await postOrderAction(action, { action: "finish", markPaid: false });
          } else {
            await postOrderAction(action, { action: "complete" });
          }
          return t("orders.actions.toastCompleted");
        }
        if (kind.type === "mark_paid") {
          await postOrderAction(action, { action: "mark-paid" });
          return t("orders.actions.toastPaid");
        }
        return t("orders.actions.toastDone");
      }

      if (kind.kind === "finish") {
        await postOrderAction(action, {
          action: "finish",
          markPaid: finishIncludePaid && canMarkPaid(order),
        });
        return t("orders.actions.toastFinished");
      }

      if (kind.kind === "mark_paid") {
        await postOrderAction(action, { action: "mark-paid" });
        return t("orders.actions.toastPaid");
      }

      if (kind.kind === "recheck") {
        await postOrderAction(action, { action: "recheck-payment" });
        return t("orders.actions.toastRecheck");
      }

      await postOrderAction(action, { action: "cancel" });
      return t("orders.actions.toastCanceled");
    },
    onError: (error) => {
      setActionError(
        mapActionError(error instanceof Error ? error.message : "order_action_failed", t),
      );
    },
    onSuccess: (message) => {
      setActionError(null);
      setPending(null);
      toast.success(message);
      router.refresh();
    },
  });

  const showMarkPaid = canMarkPaid(order);
  const showRecheck = canRecheckPayment(order);
  const showFinish = finishSteps.length > 0 || next.type !== "none";
  const showCancel = getNextAction(order).type !== "none" || canMarkPaid(order);

  if (next.type === "none" && !showMarkPaid && !showRecheck) {
    const canceled = (order.status ?? "").toLowerCase().includes("cancel");
    return (
      <div className="rounded-xl border border-dashed px-4 py-4 text-sm text-muted-foreground">
        {canceled ? t("orders.actions.canceled") : t("orders.actions.noFurther")}
      </div>
    );
  }

  const primary = (
    <div className={variant === "header" ? "flex flex-wrap items-center gap-2" : "space-y-3"}>
      {next.type !== "none" ? (
        <div
          className={
            variant === "card"
              ? "space-y-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-4"
              : "contents"
          }
        >
          {variant === "card" ? (
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-medium tracking-wide text-primary uppercase">
                  {t("orders.actions.next")}
                </p>
                <p className="mt-1 text-sm font-medium">{nextCopy.label}</p>
                <p className="mt-1 text-sm text-muted-foreground">{nextCopy.description}</p>
              </div>
              <HelpTip summary={nextCopy.description} title={nextCopy.label} />
            </div>
          ) : null}
          <Button
            disabled={mutation.isPending}
            onClick={() => setPending({ kind: "next", type: next.type })}
            type="button"
          >
            {nextCopy.label}
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {showFinish && next.type !== "none" ? (
          <Button
            disabled={mutation.isPending}
            onClick={() => setPending({ kind: "finish" })}
            type="button"
            variant="outline"
          >
            {t("orders.actions.completeAll")}
          </Button>
        ) : null}
        {showMarkPaid && next.type !== "mark_paid" ? (
          <Button
            disabled={mutation.isPending}
            onClick={() => setPending({ kind: "mark_paid" })}
            type="button"
            variant="outline"
          >
            {t("orders.actions.markPaid")}
          </Button>
        ) : null}
        {showRecheck ? (
          <Button
            disabled={mutation.isPending}
            onClick={() => setPending({ kind: "recheck" })}
            type="button"
            variant="outline"
          >
            {t("orders.actions.recheckPayment")}
          </Button>
        ) : null}
        {showCancel && !(order.status ?? "").toLowerCase().includes("cancel") ? (
          <Button
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            disabled={mutation.isPending}
            onClick={() => setPending({ kind: "cancel" })}
            type="button"
            variant="ghost"
          >
            {t("orders.actions.cancelOrder")}
          </Button>
        ) : null}
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      {actionError ? (
        <Alert variant="destructive">
          <AlertTitle>{t("orders.actions.updateFailedTitle")}</AlertTitle>
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      ) : null}

      {primary}

      <AlertDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open && !mutation.isPending) setPending(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending?.kind === "cancel"
                ? t("orders.actions.confirmCancelTitle")
                : pending?.kind === "finish"
                  ? t("orders.actions.confirmFinishTitle")
                  : pending?.kind === "mark_paid"
                    ? t("orders.actions.confirmMarkPaidTitle")
                    : pending?.kind === "recheck"
                      ? t("orders.actions.confirmRecheckTitle")
                      : nextCopy.label}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                {pending?.kind === "cancel" ? (
                  <p className="text-destructive">{t("orders.actions.confirmCancelBody")}</p>
                ) : null}
                {pending?.kind === "finish" ? (
                  <>
                    <p>{t("orders.actions.confirmFinishBody")}</p>
                    <ul className="list-disc space-y-1 pl-5">
                      {finishSteps.map((step) => (
                        <li key={step.id}>{finishStepLabel(step.id, t)}</li>
                      ))}
                      {finishSteps.length === 0 ? (
                        <li>{t("orders.actions.closeRemaining")}</li>
                      ) : null}
                    </ul>
                    {canMarkPaid(order) ? (
                      <label className="flex items-center gap-2 text-foreground">
                        <Checkbox
                          checked={finishIncludePaid}
                          onCheckedChange={(value) => setFinishIncludePaid(Boolean(value))}
                        />
                        {t("orders.actions.alsoMarkPaid")}
                      </label>
                    ) : null}
                  </>
                ) : null}
                {pending?.kind === "mark_paid" ? (
                  <p>{t("orders.actions.confirmMarkPaidBody")}</p>
                ) : null}
                {pending?.kind === "recheck" ? (
                  <p>{t("orders.actions.confirmRecheckBody")}</p>
                ) : null}
                {pending?.kind === "next" ? <p>{nextCopy.description}</p> : null}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutation.isPending}>
              {t("common.back")}
            </AlertDialogCancel>
            <AlertDialogAction
              className={
                pending?.kind === "cancel"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : undefined
              }
              disabled={mutation.isPending || !pending}
              onClick={(event) => {
                event.preventDefault();
                if (pending) mutation.mutate(pending);
              }}
            >
              {mutation.isPending
                ? t("orders.actions.working")
                : pending?.kind === "cancel"
                  ? t("orders.actions.yesCancel")
                  : t("orders.actions.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
