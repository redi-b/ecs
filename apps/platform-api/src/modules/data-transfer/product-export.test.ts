import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildProductCsv, exportProductsToCsv, productExportFilename } from "./product-export.js";

describe("product CSV export", () => {
  it("writes one UTF-8-safe row per variant and neutralizes spreadsheet formulas", () => {
    const result = buildProductCsv([
      {
        id: "prod_1",
        handle: "buna",
        title: "ቡና",
        description: '=HYPERLINK("bad")',
        status: "published",
        thumbnail: null,
        createdAt: "2026-08-25T00:00:00.000Z",
        updatedAt: "2026-08-25T00:00:00.000Z",
        variants: [
          {
            id: "var_1",
            title: "Default",
            sku: "+251",
            prices: [{ amount: 250, currencyCode: "etb" }],
          },
        ],
      },
    ]);

    assert.equal(result.rowCount, 1);
    assert.ok(result.csv.startsWith("\uFEFF"));
    assert.match(result.csv, /ቡና/);
    assert.match(result.csv, /'=HYPERLINK/);
    assert.match(result.csv, /'\+251/);
    assert.match(result.csv, /ecs-products-v1/);
  });

  it("paginates through the tenant-scoped catalog", async () => {
    const calls: number[] = [];
    const result = await exportProductsToCsv({
      salesChannelId: "sc_1",
      listProducts: async ({ offset, limit, salesChannelId }) => {
        calls.push(offset);
        assert.equal(limit, 100);
        assert.equal(salesChannelId, "sc_1");
        const products = Array.from({ length: offset === 0 ? 100 : 1 }, (_, index) => ({
          id: `prod_${offset + index}`,
          title: `Product ${offset + index}`,
          handle: `product-${offset + index}`,
          status: "published",
          thumbnail: null,
          createdAt: null,
          updatedAt: null,
        }));
        return { ok: true, products, count: 101, limit, offset };
      },
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.productCount, 101);
    assert.deepEqual(calls, [0, 100]);
  });

  it("uses a second-precise UTC timestamp in filenames", () => {
    assert.equal(
      productExportFilename(new Date("2026-08-26T14:30:15.987Z")),
      "ecs-products-20260826T143015Z.csv",
    );
  });
});
