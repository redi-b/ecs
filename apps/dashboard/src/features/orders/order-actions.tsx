"use client";

import type { MerchantOrder } from "@ecs/contracts";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

type OrderAction = "cancel" | "complete" | "deliver" | "fulfill";

type OrderActionConfig = {
  action: OrderAction;
  description: string;
  fulfillmentId?: string | undefined;
  label: string;
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
  const actions = useMemo(() => getAvailableOrderActions(order), [order]);
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

  if (!actions.length) {
    return (
      <div className="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">
        No order actions are currently available for this order state.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {actions.map((config) => (
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

      {actionError ? (
        <Alert variant="destructive">
          <AlertTitle>Order could not be updated</AlertTitle>
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
            <AlertDialogCancel disabled={mutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={mutation.isPending}
              onClick={(event) => {
                event.preventDefault();

                if (pendingAction) {
                  mutation.mutate(pendingAction);
                }
              }}
              variant={pendingAction?.variant === "destructive" ? "destructive" : "default"}
            >
              {mutation.isPending ? "Working..." : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function getAvailableOrderActions(order: MerchantOrder): OrderActionConfig[] {
  const normalizedStatus = order.status?.toLowerCase() ?? "";
  const normalizedFulfillment = order.fulfillmentStatus?.toLowerCase() ?? "";
  const isClosed = ["canceled", "cancelled", "completed", "archived"].includes(normalizedStatus);
  const actions: OrderActionConfig[] = [];

  if (!isClosed && hasFulfillableItems(order)) {
    actions.push({
      action: "fulfill",
      description:
        "This will create a fulfillment for all remaining unfulfilled items using this shop's stock location.",
      label: "Fulfill remaining items",
      success: "Order fulfillment created.",
      title: "Fulfill this order?",
    });
  }

  for (const fulfillment of order.fulfillments ?? []) {
    if (!fulfillment.deliveredAt && !fulfillment.canceledAt) {
      actions.push({
        action: "deliver",
        description: "This marks the selected fulfillment as delivered.",
        fulfillmentId: fulfillment.id,
        label: "Mark delivered",
        success: "Fulfillment marked as delivered.",
        title: "Mark fulfillment delivered?",
      });
      break;
    }
  }

  if (!isClosed && normalizedFulfillment === "delivered") {
    actions.push({
      action: "complete",
      description: "This completes the order after fulfillment is delivered.",
      label: "Complete order",
      success: "Order completed.",
      title: "Complete this order?",
    });
  }

  if (!isClosed) {
    actions.push({
      action: "cancel",
      description:
        "Cancel this order only when the customer or merchant has confirmed it should not continue.",
      label: "Cancel order",
      success: "Order canceled.",
      title: "Cancel this order?",
      variant: "destructive",
    });
  }

  return actions;
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
    return "This order has no remaining items that can be fulfilled.";
  }

  if (error === "order_fulfillment_not_found") {
    return "That fulfillment could not be found for this order.";
  }

  if (error === "inventory_location_unavailable") {
    return "This shop does not have a stock location configured.";
  }

  if (error === "order_not_found") {
    return "This order is no longer available for this shop.";
  }

  if (error === "commerce_credentials_invalid" || error === "commerce_credentials_missing") {
    return "Commerce access is not configured correctly.";
  }

  return "The order action is temporarily unavailable. Try again.";
}
