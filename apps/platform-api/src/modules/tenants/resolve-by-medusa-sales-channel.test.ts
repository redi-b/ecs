import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createResolveTenantIdByMedusaSalesChannel } from "./resolve-by-medusa-sales-channel.js";

describe("createResolveTenantIdByMedusaSalesChannel", () => {
  it("returns tenant id when sales channel matches", async () => {
    const resolve = createResolveTenantIdByMedusaSalesChannel({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [{ id: "tenant-uuid" }],
          }),
        }),
      }),
    } as never);

    assert.equal(await resolve("sc_123"), "tenant-uuid");
  });

  it("returns null when no row", async () => {
    const resolve = createResolveTenantIdByMedusaSalesChannel({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [],
          }),
        }),
      }),
    } as never);

    assert.equal(await resolve("missing"), null);
  });

  it("returns null for blank sales channel id", async () => {
    const resolve = createResolveTenantIdByMedusaSalesChannel({
      select: () => {
        throw new Error("should not query");
      },
    } as never);

    assert.equal(await resolve("  "), null);
  });
});
