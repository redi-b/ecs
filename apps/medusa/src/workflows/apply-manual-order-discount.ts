import { Modules } from "@medusajs/framework/utils";
import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";

import type { ManualOrderAdjustmentInput } from "../lib/manual-order-adjustment";
import { allocateManualOrderDiscount } from "../lib/manual-order-discount";

type Input = ManualOrderAdjustmentInput & { order_id: string };

const applyManualOrderDiscountStep = createStep<Input, { amount: number; ids: string[] }, string[]>(
  "apply-manual-order-discount",
  async (input: Input, { container }) => {
    const orderService = container.resolve(Modules.ORDER) as any;
    const order = await orderService.retrieveOrder(input.order_id, { relations: ["items"] });
    if (order.status !== "draft" || order.metadata?.platform_tenant_id !== input.tenant_id) {
      throw new Error("manual_order_discount_forbidden");
    }

    const items = (order.items ?? []).filter((item: any) => Number(item.quantity) > 0);
    const allocation = allocateManualOrderDiscount(
      items.map((item: any) => ({
        id: item.id,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unit_price ?? 0),
      })),
      input.discount,
    );
    const adjustments = allocation.adjustments.map(({ amount, itemId }) => {
      return {
        amount,
        code: "MANUAL_ORDER_DISCOUNT",
        description: input.reason,
        item_id: itemId,
        order_id: order.id,
        provider_id: "platform_manual_order",
        version: order.version,
      };
    });

    const created = await orderService.createOrderLineItemAdjustments(adjustments);
    return new StepResponse(
      { amount: allocation.amount, ids: created.map((adjustment: any) => adjustment.id) },
      created.map((adjustment: any) => adjustment.id),
    );
  },
  async (ids: string[] | undefined, { container }) => {
    if (!ids?.length) return;
    const orderService = container.resolve(Modules.ORDER) as any;
    await orderService.deleteOrderLineItemAdjustments(ids);
  },
);

export const applyManualOrderDiscountWorkflow = createWorkflow(
  "apply-manual-order-discount-workflow",
  function (input: Input) {
    const result = applyManualOrderDiscountStep(input);
    return new WorkflowResponse(result);
  },
);
