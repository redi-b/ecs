import assert from "node:assert/strict";
import { it } from "node:test";
import {
  DomainSettingsError,
  getDomainSettings,
  mutateDomainSettings,
} from "./domain-settings-client.js";

it("fetches tenant-scoped settings without caching and passes cancellation", async () => {
  const controller = new AbortController();
  let request: Request | undefined;
  const result = await getDomainSettings({
    tenantId: "tenant_1",
    signal: controller.signal,
    fetcher: async (input, init) => {
      request = new Request(new URL(String(input), "https://app.ecset.dev"), init);
      assert.equal(init?.signal, controller.signal);
      return Response.json({
        domains: [],
        setup: {
          enabled: true,
          entitled: true,
          dnsTarget: "domains.ecset.dev",
          ingressIpv4: ["178.238.224.27"],
        },
      });
    },
  });
  assert.equal(request?.url, "https://app.ecset.dev/dashboard/settings/domains?tenantId=tenant_1");
  assert.equal(request?.cache, "no-store");
  assert.equal(result.setup?.enabled, true);
});

it("treats accepted removal as pending and rejects malformed success bodies", async () => {
  const options = {
    tenantId: "tenant_1",
    action: { action: "remove" as const, domainId: "domain_1" },
  };
  assert.deepEqual(
    await mutateDomainSettings({
      ...options,
      fetcher: async () => Response.json({ status: "removing" }, { status: 202 }),
    }),
    { kind: "removal", status: "removing" },
  );
  await assert.rejects(
    mutateDomainSettings({ ...options, fetcher: async () => Response.json({ status: "active" }) }),
    (error: unknown) =>
      error instanceof DomainSettingsError && error.code === "domain_response_invalid",
  );
});

it("preserves bounded failure codes without exposing response bodies as messages", async () => {
  await assert.rejects(
    getDomainSettings({
      tenantId: "tenant_1",
      fetcher: async () =>
        Response.json(
          { error: "dashboard_forbidden", privateDetail: "internal route" },
          { status: 403 },
        ),
    }),
    (error: unknown) =>
      error instanceof DomainSettingsError &&
      error.code === "dashboard_forbidden" &&
      error.status === 403,
  );
});
