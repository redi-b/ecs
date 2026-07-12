"use client";

import type { MerchantOrder } from "@ecs/contracts";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

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
import { formatOrderStatusLabel } from "@/features/orders/order-table-state";

type OrderAction = "cancel" | "complete" | "deliver" | "fulfill";

type OrderActionConfig = {
  action: OrderAction;
  description: string;
  fulfillmentId?: string | undefined;
  label: string;
  primary?: boolean | undefined;
  success: string;
  title: string;
  variant?: "default" | "destructive" | "outline";
};

type OrderActionsProps = {
  action: string;
  order: MerchantOrder;
};

export function OrderActions({ action, order }: OrderActionsProps) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<OrderActionConfig | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const { nextStep, secondary } = useMemo(() => getOrderActionGroups(order), [order]);
  const mutation = useMutation({
    mutationFn: async (config: OrderActionConfig) => {
      const response = await fetch(action, {
        body: JSON.stringify({
          action: config.action,
          ...(config.fulfillmentId ? { fulfillmentId: config.fulfillmentId } : {}),
        }),
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        method: "POST",
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(getOrderActionErrorMessage(data.error));
      }
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : "Order action failed.");
    },
    onSuccess: async (_data, config) => {
      setActionError(null);
      setPendingAction(null);
      toast.success(config.success);
      router.refresh();
    },
  });

  if (!nextStep && secondary.length === 0) {
    return (
      <div className="rounded-xl border border-dashed px-4 py-5 text-sm text-muted-foreground">
        No further actions for this order.
        {order.status?.toLowerCase().includes("cancel")
          ? " It was canceled."
          : order.status?.toLowerCase() === "completed"
            ? " It is already completed."
            : ""}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {nextStep ? (
        <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-4">
          <div>
            <p className="text-xs font-medium tracking-wide text-primary uppercase">Next step</p>
            <p className="mt-1 text-sm font-medium text-foreground">{nextStep.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{nextStep.description}</p>
          </div>
          <Button
            className="w-full sm:w-auto"
            onClick={() => setPendingAction(nextStep)}
            type="button"
          >
            {nextStep.label}
          </Button>
        </div>
      ) : null}

      {secondary.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {secondary.map((config) => (
            <Button
              key={`${config.action}-${config.fulfillmentId ?? "order"}`}
              onClick={() => setPendingAction(config)}
              type="button"
              variant={config.variant ?? "outline"}
            >
              {config.label}
            </Button>
          ))}
        </div>
      ) : null}

      {actionError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not update order</AlertTitle>
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      ) : null}

      <AlertDialog
        onOpenChange={(open) => {
          if (!open && !mutation.isPending) {
            setPendingAction(null);
          }
        }}
        open={Boolean(pendingAction)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pendingAction?.title}</AlertDialogTitle>
            <AlertDialogDescription>{pendingAction?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutation.isPending}>Go back</AlertDialogCancel>
            <AlertDialogAction
              disabled={mutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (pendingAction) mutation.mutate(pendingAction);
              }}
              variant={pendingAction?.variant === "destructive" ? "destructive" : "default"}
            >
              {mutation.isPending ? "Working…" : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function getOrderProgressSteps(order: MerchantOrder) {
  const fulfillment = (order.fulfillmentStatus ?? "").toLowerCase();
  const status = (order.status ?? "").toLowerCase();
  const isCanceled = status.includes("cancel");
  const packed =
    ["fulfilled", "shipped", "delivered", "partially_fulfilled"].includes(fulfillment) ||
    (order.fulfillments?.length ?? 0) > 0;
  const delivered =
    fulfillment === "delivered" ||
    (order.fulfillments ?? []).some((item) => Boolean(item.deliveredAt));
  const completed = status === "completed";

  return [
    {
      done: !isCanceled,
      id: "received",
      label: "Received",
    },
    {
      done: packed || delivered || completed,
      id: "packed",
      label: "Packed",
    },
    {
      done: delivered || completed,
      id: "delivered",
      label: "Delivered",
    },
    {
      done: completed,
      id: "done",
      label: "Done",
    },
  ] as const;
}

function getOrderActionGroups(order: MerchantOrder): {
  nextStep: OrderActionConfig | null;
  secondary: OrderActionConfig[];
} {
  const normalizedStatus = order.status?.toLowerCase() ?? "";
  const isClosed = ["canceled", "cancelled", "completed", "archived"].includes(normalizedStatus);
  const secondary: OrderActionConfig[] = [];
  let nextStep: OrderActionConfig | null = null;

  if (isClosed) {
    return { nextStep: null, secondary: [] };
  }

  if (hasFulfillableItems(order)) {
    nextStep = {
      action: "fulfill",
      description:
        "Mark the items as packed and ready to hand to the customer or courier. Stock will be reduced for this shop.",
      label: "Mark packed & ready",
      primary: true,
      success: "Order marked as packed.",
      title: "Mark order packed?",
    };
  } else {
    const openFulfillment = (order.fulfillments ?? []).find(
      (fulfillment) => !fulfillment.deliveredAt && !fulfillment.canceledAt,
    );

    if (openFulfillment) {
      nextStep = {
        action: "deliver",
        description:
          "Use this when the customer has received the order (COD handoff or courier delivered).",
        fulfillmentId: openFulfillment.id,
        label: "Mark delivered",
        primary: true,
        success: "Order marked as delivered.",
        title: "Mark as delivered?",
      };
    } else if ((order.fulfillmentStatus ?? "").toLowerCase() === "delivered") {
      nextStep = {
        action: "complete",
        description: "Close this order after delivery is finished.",
        label: "Complete order",
        primary: true,
        success: "Order completed.",
        title: "Complete this order?",
      };
    }
  }

  secondary.push({
    action: "cancel",
    description: "Only cancel if the sale will not go ahead. This cannot always be undone.",
    label: "Cancel order",
    success: "Order canceled.",
    title: "Cancel this order?",
    variant: "destructive",
  });

  return { nextStep, secondary };
}

function hasFulfillableItems(order: MerchantOrder) {
  return (order.items ?? []).some((item) => {
    const quantity = item.quantity ?? 0;
    const fulfilledQuantity = item.fulfilledQuantity ?? 0;
    return quantity - fulfilledQuantity > 0;
  });
}

function getOrderActionErrorMessage(error: string | undefined) {
  if (error === "order_not_fulfillable") {
    return "There is nothing left to pack on this order.";
  }
  if (error === "order_fulfillment_not_found") {
    return "Could not find packing record for this order. Refresh and try again.";
  }
  if (error === "inventory_location_unavailable") {
    return "This shop still needs a stock location before packing orders.";
  }
  if (error === "order_not_found") {
    return "This order is no longer available.";
  }
  if (error === "commerce_credentials_invalid" || error === "commerce_credentials_missing") {
    return "Commerce access is not configured correctly.";
  }
  return "Something went wrong. Try again in a moment.";
}

export function describeOrderPayment(order: MerchantOrder) {
  return formatOrderStatusLabel(order.paymentStatus, "payment");
}
