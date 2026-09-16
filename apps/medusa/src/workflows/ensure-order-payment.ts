import {
  createOrderPaymentCollectionWorkflow,
  markPaymentCollectionAsPaid,
} from "@medusajs/medusa/core-flows";
import {
  createWorkflow,
  transform,
  when,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { useQueryGraphStep } from "@medusajs/medusa/core-flows";

type Input = { order_id: string };

/** Backfills the native Medusa payment ledger for legacy manually-paid orders. */
export const ensureOrderPaymentWorkflow = createWorkflow(
  "ensure-order-payment",
  function (input: Input) {
    const { data: order } = useQueryGraphStep({
      entity: "order",
      fields: ["id", "total", "payment_collections.id", "payment_collections.status"],
      filters: { id: input.order_id },
      options: { isList: false, throwIfKeyNotFound: true },
    }).config({ name: "get-order-for-payment-repair" });

    const existing = transform({ order }, ({ order }) => order.payment_collections?.[0] ?? null);
    const created = when({ existing }, ({ existing }) => !existing).then(() =>
      createOrderPaymentCollectionWorkflow.runAsStep({
        input: { amount: order.total, order_id: order.id },
      }),
    );
    const paymentCollection = transform(
      { created, existing },
      ({ created, existing }) => existing ?? created?.[0],
    );
    const shouldCapture = transform(
      { paymentCollection },
      ({ paymentCollection }) => paymentCollection?.status === "not_paid",
    );
    when({ shouldCapture }, ({ shouldCapture }) => shouldCapture).then(() =>
      markPaymentCollectionAsPaid.runAsStep({
        input: { order_id: order.id, payment_collection_id: paymentCollection.id },
      }),
    );

    return new WorkflowResponse(paymentCollection);
  },
);
