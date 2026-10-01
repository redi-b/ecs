import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { DEMO_DELIVERY_FEE, syncDemoDeliveryPrice } from "./demo-delivery.js";

test("demo delivery synchronizes the actual Medusa option to the displayed ETB fee", async () => {
  const calls: unknown[] = [];
  await syncDemoDeliveryPrice("so_demo", async (input) => {
    calls.push(input);
    return { ok: true };
  });
  assert.equal(DEMO_DELIVERY_FEE, 75);
  assert.deepEqual(calls, [{ shippingOptionId: "so_demo", amount: 75, currencyCode: "etb" }]);
});

test("demo delivery fails closed on missing option or failed commerce synchronization", async () => {
  await assert.rejects(
    syncDemoDeliveryPrice(null, async () => {
      assert.fail("must not update without an option");
    }),
    /missing shipping option/,
  );
  await assert.rejects(
    syncDemoDeliveryPrice("so_demo", async () => ({
      ok: false,
      error: "commerce_backend_unavailable",
    })),
    /commerce_backend_unavailable/,
  );
});

test("seed synchronizes delivery before writing display settings and uses one fee source", async () => {
  const seed = await readFile(new URL("./demo-seed.ts", import.meta.url), "utf8");
  const extras = await readFile(new URL("./demo-platform-data.ts", import.meta.url), "utf8");
  assert.ok(seed.indexOf("await syncDemoDeliveryPrice(") >= 0);
  assert.ok(
    seed.indexOf("await syncDemoDeliveryPrice(") < seed.indexOf("await seedPlatformExtras("),
  );
  assert.equal((extras.match(/defaultDeliveryFee: String\(DEMO_DELIVERY_FEE\)/g) ?? []).length, 2);
});
