import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { runProductWriteCommand } from "./product-write-command.js";

const product = {
  id: "prod_1",
  images: [{ url: "https://media.example/product.webp" }],
  options: [
    {
      values: [
        {
          swatch: {
            kind: "image",
            url: "https://media.example/swatch.webp",
          },
        },
      ],
    },
  ],
  thumbnail: "https://media.example/cover.webp",
  variants: [{ imageUrl: "https://media.example/variant.webp" }],
};

describe("runProductWriteCommand", () => {
  it("synchronizes all media references after a successful write", async () => {
    const syncCalls: unknown[] = [];

    const command = await runProductWriteCommand(
      {
        getProduct: async () => ({ ok: true, product }) as never,
        syncProductMedia: async (input) => {
          syncCalls.push(input);
          return { ok: true } as never;
        },
        write: async () => ({ ok: true, product }) as never,
      },
      {
        salesChannelId: "sc_1",
        synchronizeMedia: true,
        tenantId: "tenant_1",
      },
    );

    assert.equal(command.result.ok, true);
    assert.equal(command.mediaSyncWarning, false);
    assert.deepEqual(syncCalls, [
      {
        imageUrls: ["https://media.example/product.webp", "https://media.example/swatch.webp"],
        productId: "prod_1",
        tenantId: "tenant_1",
        thumbnail: "https://media.example/cover.webp",
        variantImageUrls: ["https://media.example/variant.webp"],
      },
    ]);
  });

  it("preserves the successful write and reports a warning when synchronization fails", async () => {
    const command = await runProductWriteCommand(
      {
        getProduct: async () => ({ ok: false, error: "product_not_found", status: 404 }) as never,
        syncProductMedia: async () => {
          throw new Error("should not run without the written product");
        },
        write: async () => ({ ok: true, product }) as never,
      },
      {
        productId: "prod_1",
        salesChannelId: "sc_1",
        synchronizeMedia: true,
        tenantId: "tenant_1",
      },
    );

    assert.equal(command.result.ok, true);
    assert.equal(command.mediaSyncWarning, true);
  });

  it("does not synchronize failed writes or writes without media changes", async () => {
    let reads = 0;
    const command = await runProductWriteCommand(
      {
        getProduct: async () => {
          reads += 1;
          return { ok: true, product } as never;
        },
        syncProductMedia: async () => ({ ok: true }) as never,
        write: async () => ({ ok: true, product }) as never,
      },
      {
        salesChannelId: "sc_1",
        synchronizeMedia: false,
        tenantId: "tenant_1",
      },
    );

    assert.equal(command.mediaSyncWarning, false);
    assert.equal(reads, 0);
  });
});
