import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { planVersions, plans } from "@ecs/db";

import { DEFAULT_PLANS } from "./plan-catalog.js";
import { createBillingPlanService } from "./plan-service.js";

describe("billing plan bootstrap", () => {
  it("does not republish defaults over operator-published versions", async () => {
    const insertedTables: unknown[] = [];
    let selectedPlan = 0;
    const db = {
      insert(table: unknown) {
        insertedTables.push(table);
        return {
          values() {
            return {
              onConflictDoNothing() {
                return { returning: async () => [] };
              },
            };
          },
        };
      },
      select() {
        const plan = DEFAULT_PLANS[selectedPlan++];
        assert.ok(plan);
        return {
          from() {
            return {
              where() {
                return {
                  orderBy() {
                    return {
                      limit: async () => [
                        {
                          billingInterval: "month",
                          currency: "ETB",
                          features: plan.features,
                          fingerprint: `operator-${plan.id}`,
                          id: crypto.randomUUID(),
                          limits: plan.limits,
                          name: plan.name,
                          planId: plan.id,
                          price: "1.00",
                          publishedAt: new Date(),
                          trialPolicy: { enabled: false },
                          version: 2,
                        },
                      ],
                    };
                  },
                };
              },
            };
          },
        };
      },
    };

    await createBillingPlanService(db as never).ensureDefaultPlans();

    assert.equal(insertedTables.filter((table) => table === plans).length, DEFAULT_PLANS.length);
    assert.equal(insertedTables.filter((table) => table === planVersions).length, 0);
  });
});
