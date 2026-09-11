import assert from "node:assert/strict";
import { test } from "node:test";

import { getAllPlatformTenants } from "./platform-onboarding.js";

test("loads every membership page for the shop picker", async () => {
  const offsets: string[] = [];
  const result = await getAllPlatformTenants({
    fetcher: async (input) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      const offset = url.searchParams.get("offset") ?? "0";
      offsets.push(offset);
      const start = Number(offset);
      const count = 101;
      const size = start === 0 ? 100 : 1;
      return Response.json({
        count,
        limit: 100,
        offset: start,
        tenants: Array.from({ length: size }, (_, index) => {
          const id = `tenant_${start + index}`;
          return {
            createdAt: "2026-09-01T00:00:00.000Z",
            handle: id,
            id,
            name: id,
            primaryDomain: { hostname: `${id}.lvh.me` },
            role: "viewer",
            status: "active",
            updatedAt: "2026-09-01T00:00:00.000Z",
          };
        }),
      });
    },
    platformApiBaseUrl: "http://platform.test",
  });

  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.tenants.length, 101);
  assert.deepEqual(offsets, ["0", "100"]);
});
