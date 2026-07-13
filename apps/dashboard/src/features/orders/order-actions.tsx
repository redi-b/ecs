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

function mapActionError(message: string) {
  switch (message) {
    case "order_not_fulfillable":
      return "Couldn’t pack this order. Products may not share this shop’s delivery profile — try re-saving the product or contact support.";
    case "order_fulfillment_not_found":
      return "Could not find a package to update.";
    case "inventory_location_unavailable":
      return "Stock location isn’t set up for packing yet.";
    case "order_not_found":
      return "Order not found.";
    default:
      return message || "Could not update this order.";
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
  const router = useRouter();
  const next = useMemo(() => getNextAction(order), [order]);
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
          return "Order marked ready.";
        }
        if (kind.type === "mark_completed") {
          // Deliver open fulfillments then complete.
          const open = (order.fulfillments ?? []).filter(
            (item) => !item.deliveredAt && !item.canceledAt,
          );
          for (const fulfillment of open) {
            await postOrderAction(action, {
              action: "deliver",
              fulfillmentId: fulfillment.id,
            });
          }
          // If no fulfillment yet, finish path handles pack+deliver+complete
          if (open.length === 0) {
            await postOrderAction(action, { action: "finish", markPaid: false });
          } else {
            await postOrderAction(action, { action: "complete" });
          }
          return "Order marked completed.";
        }
        if (kind.type === "mark_paid") {
          await postOrderAction(action, { action: "mark-paid" });
          return "Payment recorded.";
        }
        return "Done.";
      }

      if (kind.kind === "finish") {
        await postOrderAction(action, {
          action: "finish",
          markPaid: finishIncludePaid && canMarkPaid(order),
        });
        return "Remaining steps finished.";
      }

      if (kind.kind === "mark_paid") {
        await postOrderAction(action, { action: "mark-paid" });
        return "Payment recorded.";
      }

      if (kind.kind === "recheck") {
        await postOrderAction(action, { action: "recheck-payment" });
        return "Payment checked with Chapa.";
      }

      await postOrderAction(action, { action: "cancel" });
      return "Order canceled.";
    },
    onError: (error) => {
      setActionError(mapActionError(error instanceof Error ? error.message : "order_action_failed"));
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
        {canceled ? "This order was canceled." : "No further steps for this order."}
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
                <p className="text-xs font-medium tracking-wide text-primary uppercase">Next</p>
                <p className="mt-1 text-sm font-medium">{next.label}</p>
                <p className="mt-1 text-sm text-muted-foreground">{next.description}</p>
              </div>
              <HelpTip summary={next.description} title={next.label} />
            </div>
          ) : null}
          <Button
            disabled={mutation.isPending}
            onClick={() => setPending({ kind: "next", type: next.type })}
            type="button"
          >
            {next.label}
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
            Complete all steps
          </Button>
        ) : null}
        {showMarkPaid && next.type !== "mark_paid" ? (
          <Button
            disabled={mutation.isPending}
            onClick={() => setPending({ kind: "mark_paid" })}
            type="button"
            variant="outline"
          >
            Mark as paid
          </Button>
        ) : null}
        {showRecheck ? (
          <Button
            disabled={mutation.isPending}
            onClick={() => setPending({ kind: "recheck" })}
            type="button"
            variant="outline"
          >
            Re-check payment
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
            Cancel order
          </Button>
        ) : null}
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      {actionError ? (
        <Alert variant="destructive">
          <AlertTitle>Couldn’t update order</AlertTitle>
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
                ? "Cancel this order?"
                : pending?.kind === "finish"
                  ? "Complete all remaining steps?"
                  : pending?.kind === "mark_paid"
                    ? "Mark as paid?"
                    : pending?.kind === "recheck"
                      ? "Re-check payment?"
                      : next.label}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                {pending?.kind === "cancel" ? (
                  <p className="text-destructive">
                    This permanently cancels the sale. Only do this if the order will not go ahead.
                  </p>
                ) : null}
                {pending?.kind === "finish" ? (
                  <>
                    <p>
                      Runs every open step at once so you don’t click through one by one:
                    </p>
                    <ul className="list-disc space-y-1 pl-5">
                      {finishSteps.map((step) => (
                        <li key={step.id}>{step.label}</li>
                      ))}
                      {finishSteps.length === 0 ? <li>Close out remaining work</li> : null}
                    </ul>
                    {canMarkPaid(order) ? (
                      <label className="flex items-center gap-2 text-foreground">
                        <Checkbox
                          checked={finishIncludePaid}
                          onCheckedChange={(value) => setFinishIncludePaid(Boolean(value))}
                        />
                        Also mark as paid (cash received)
                      </label>
                    ) : null}
                  </>
                ) : null}
                {pending?.kind === "mark_paid" ? (
                  <p>Record that you received payment for this order.</p>
                ) : null}
                {pending?.kind === "recheck" ? (
                  <p>Ask Chapa if this online payment went through, then update the order.</p>
                ) : null}
                {pending?.kind === "next" ? <p>{next.description}</p> : null}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutation.isPending}>Back</AlertDialogCancel>
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
                ? "Working…"
                : pending?.kind === "cancel"
                  ? "Yes, cancel order"
                  : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
