import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadOrderForNotification } from "./load-order-for-notification";

describe("loadOrderForNotification", () => {
  it("reads valid ETB unit costs and leaves missing or unsupported costs unknown", async () => {
    const order = await loadOrderForNotification(
      {
        graph: async (input) => {
          assert.equal(input.entity, "order");
          assert.deepEqual(input.filters, { id: "order_1" });
          assert.ok(input.fields.includes("items.variant.metadata"));
          return {
            data: [
              {
                created_at: "2026-09-30T10:00:00.000Z",
                id: "order_1",
                items: [
                  {
                    id: "item_1",
                    quantity: 2,
                    variant: {
                      metadata: {
                        ecs_unit_cost_amount: 90,
                        ecs_unit_cost_currency: "etb",
                      },
                    },
                    variant_id: "variant_1",
                  },
                  {
                    id: "item_2",
                    quantity: 1,
                    variant: {
                      metadata: {
                        ecs_unit_cost_amount: 50,
                        ecs_unit_cost_currency: "usd",
                      },
                    },
                    variant_id: "variant_2",
                  },
                ],
              },
            ],
          };
        },
      },
      "order_1",
    );

    assert.equal(order?.created_at, "2026-09-30T10:00:00.000Z");
    assert.deepEqual(order?.items, [
      { id: "item_1", quantity: 2, unit_cost_amount: 90, variant_id: "variant_1" },
      { id: "item_2", quantity: 1, unit_cost_amount: null, variant_id: "variant_2" },
    ]);
  });
});
