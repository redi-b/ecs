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
import { hasFulfillableItems } from "@/features/orders/order-table-state";

type OrderAction = "cancel" | "complete" | "deliver" | "fulfill";

type OrderActionConfig = {
  action: OrderAction | "finish";
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
  const { nextStep, secondary } = useMemo(() => getOrderActionGroups(order), [order]);

  const mutation = useMutation({
    mutationFn: async (config: OrderActionConfig) => {
      if (config.action === "finish") {
        await runFinishOrder(action, order);
        return;
      }

      await postOrderAction(action, {
        action: config.action,
        ...(config.fulfillmentId ? { fulfillmentId: config.fulfillmentId } : {}),
      });
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : "Could not update this order.");
    },
    onSuccess: async (_data, config) => {
      setActionError(null);
      setPendingAction(null);
      toast.success(config.success);
      router.refresh();
    },
  });

  if (!nextStep && secondary.length === 0) {
    const status = (order.status ?? "").toLowerCase();
    return (
      <div className="rounded-xl border border-dashed px-4 py-5 text-sm text-muted-foreground">
        {status.includes("cancel")
          ? "This order was canceled."
          : status === "completed"
            ? "This order is complete."
            : "No further actions for this order."}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {nextStep ? (
        <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-4">
          <div>
            <p className="text-xs font-medium tracking-wide text-primary uppercase">Next</p>
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
          if (!open && !mutation.isPending) setPendingAction(null);
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

/**
 * One-click path for merchants: prepare items, mark delivered, then close.
 */
async function runFinishOrder(endpoint: string, order: MerchantOrder) {
  let current: MerchantOrder = order;

  if (hasFulfillableItems(current)) {
    const result = await postOrderAction(endpoint, { action: "fulfill" });
    if (result.order) current = result.order;
  }

  const openFulfillment = (current.fulfillments ?? []).find(
    (item) => !item.deliveredAt && !item.canceledAt,
  );

  if (openFulfillment) {
    const result = await postOrderAction(endpoint, {
      action: "deliver",
      fulfillmentId: openFulfillment.id,
    });
    if (result.order) current = result.order;
  }

  const status = (current.status ?? "").toLowerCase();
  if (status !== "completed" && !status.includes("cancel")) {
    try {
      await postOrderAction(endpoint, { action: "complete" });
    } catch (error) {
      // Medusa may complete successfully while the follow-up read races.
      // If list already shows Done, don't surface a scary false failure.
      const message = error instanceof Error ? error.message : "";
      if (!message.includes("no longer available")) {
        throw error;
      }
    }
  }
}

async function postOrderAction(
  endpoint: string,
  body: { action: OrderAction; fulfillmentId?: string },
) {
  const response = await fetch(endpoint, {
    body: JSON.stringify(body),
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    method: "POST",
  });
  const data = (await response.json().catch(() => ({}))) as {
    error?: string;
    order?: MerchantOrder;
  };

  if (!response.ok) {
    throw new Error(getOrderActionErrorMessage(data.error));
  }

  return data;
}

function getOrderActionGroups(order: MerchantOrder): {
  nextStep: OrderActionConfig | null;
  secondary: OrderActionConfig[];
} {
  const normalizedStatus = order.status?.toLowerCase() ?? "";
  const isClosed = ["canceled", "cancelled", "completed", "archived"].includes(normalizedStatus);

  if (isClosed) {
    return { nextStep: null, secondary: [] };
  }

  const nextStep: OrderActionConfig = {
    action: "finish",
    description:
      "Use this when the order is finished — items prepared and given to the customer (or sent with a courier). This closes the order in one step.",
    label: "Complete order",
    success: "Order completed.",
    title: "Complete this order?",
  };

  const secondary: OrderActionConfig[] = [
    {
      action: "cancel",
      description: "Only cancel if this sale will not go ahead.",
      label: "Cancel order",
      success: "Order canceled.",
      title: "Cancel this order?",
      variant: "destructive",
    },
  ];

  return { nextStep, secondary };
}

function getOrderActionErrorMessage(error: string | undefined) {
  if (error === "order_not_fulfillable") {
    return "There is nothing left to prepare on this order.";
  }
  if (error === "order_fulfillment_not_found") {
    return "Could not update delivery for this order. Refresh and try again.";
  }
  if (error === "inventory_location_unavailable") {
    return "This shop still needs a stock location before completing orders.";
  }
  if (error === "order_not_found") {
    return "This order is no longer available.";
  }
  if (error === "commerce_credentials_invalid" || error === "commerce_credentials_missing") {
    return "Commerce access is not configured correctly.";
  }
  return "Something went wrong. Try again in a moment.";
}
