import assert from "node:assert/strict";
import { test } from "node:test";

import type { MerchantOrder, MerchantOrderReturn } from "@ecs/contracts";
import { getReceivableReturnItems } from "./receive-return-dialog";

test("return receipt offers only the unclassified requested quantity", () => {
  const order = {
    id: "order_1",
    items: [
      { id: "item_1", quantity: 3, title: "Coffee" },
      { id: "item_2", quantity: 1, title: "Tea" },
    ],
  } as MerchantOrder;
  const orderReturn = {
    id: "return_1",
    items: [
      {
        id: "retitem_1",
        lineItemId: "item_1",
        quantity: 3,
        receivedQuantity: 1,
        damagedQuantity: 1,
        reasonId: null,
        note: null,
      },
      {
        id: "retitem_2",
        lineItemId: "item_2",
        quantity: 1,
        receivedQuantity: 1,
        damagedQuantity: 0,
        reasonId: null,
        note: null,
      },
    ],
  } as MerchantOrderReturn;

  assert.deepEqual(
    getReceivableReturnItems(order, orderReturn).map(({ item, maximum }) => ({
      id: item.id,
      maximum,
    })),
    [{ id: "item_1", maximum: 1 }],
  );
});
