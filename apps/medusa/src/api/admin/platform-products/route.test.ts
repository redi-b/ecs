import assert from "node:assert/strict";
import { test } from "node:test";
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import middlewares from "../../middlewares";
import { GET } from "./route";

test("media product request resolves sales-channel links before querying Product", async () => {
  type QueryInput = {
    entity: string;
    filters: Record<string, unknown>;
    pagination?: { take?: number };
  };
  type RouteMiddleware = (
    request: AuthenticatedMedusaRequest,
    response: MedusaResponse,
    next: (error?: unknown) => void,
  ) => unknown;
  const calls: QueryInput[] = [];
  const req = {
    query: {
      media: "without_media",
      sales_channel_id: ["sc_1"],
      limit: "20",
      offset: "0",
      order: "-created_at",
      fields: "id,title",
    },
    scope: {
      resolve: () => ({
        graph: async (input: QueryInput) => {
          calls.push(input);
          if (input.entity === "product_sales_channel") {
            assert.deepEqual(input.filters, { sales_channel_id: ["sc_1"] });
            return { data: [{ product_id: "prod_1" }] };
          }
          assert.equal(input.entity, "product");
          assert.equal(
            "sales_channel_id" in input.filters,
            false,
            "Product.sales_channel_id must be resolved by Medusa's link middleware",
          );
          assert.deepEqual(input.filters.id, ["prod_1"]);
          assert.equal(input.pagination?.take, 20);
          return { data: [], metadata: { count: 0, skip: 0, take: 20 } };
        },
      }),
    },
  } as unknown as AuthenticatedMedusaRequest;
  let body: unknown;
  const res = {
    json: (value: unknown) => {
      body = value;
    },
  } as MedusaResponse;
  const route = middlewares.routes?.find((item) => item.matcher === "/admin/platform-products");
  assert.ok(route);
  for (const middleware of route.middlewares ?? []) {
    await new Promise<void>((resolve, reject) => {
      Promise.resolve(
        (middleware as RouteMiddleware)(req, res, (error?: unknown) =>
          error ? reject(error) : resolve(),
        ),
      ).catch(reject);
    });
  }
  await GET(req, res);
  assert.deepEqual(
    calls.map((call) => call.entity),
    ["product_sales_channel", "product"],
  );
  assert.deepEqual(body, { products: [], count: 0, offset: 0, limit: 20 });
});
