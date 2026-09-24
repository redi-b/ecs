import assert from "node:assert/strict";
import { test } from "node:test";
import { GET } from "./route";

test("customer group lookup scopes metadata before pagination and rejects duplicate tenant groups", async () => {
  for (const count of [0, 1, 2]) {
    let status = 200;
    let body: any;
    const response = {
      status(value: number) {
        status = value;
        return response;
      },
      json(value: unknown) {
        body = value;
      },
    };
    await GET(
      {
        validatedQuery: { tenant_id: "one" },
        scope: {
          resolve: () => ({
            listAndCountCustomerGroups: async (filters: any, config: any) => {
              assert.deepEqual(filters, { metadata: { tenant_id: "one" } });
              assert.equal(config.take, 2);
              return [[], count];
            },
          }),
        },
      } as any,
      response as any,
    );
    assert.equal(status, count > 1 ? 409 : 200);
    if (count > 1) assert.equal(body.error, "duplicate_tenant_customer_group");
  }
});
