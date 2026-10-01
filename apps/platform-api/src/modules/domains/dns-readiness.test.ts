import assert from "node:assert/strict";
import { it } from "node:test";
import { createDomainDnsProbe, createDomainTxtResolver } from "./dns-readiness.js";

const ingress = "178.238.224.27";
const input = { hostname: "shop.example.com", ownershipValue: "ecs-domain-verification=token" };

it("bounds manual TXT verification and cleans up the independent resolver", async () => {
  let cancelled = 0;
  const resolveTxt = createDomainTxtResolver({
    timeoutMs: 10,
    createResolver: () => ({
      resolveTxt: () => new Promise(() => {}),
      cancel: () => {
        cancelled++;
      },
    }),
  });
  await assert.rejects(resolveTxt("_ecs-verification.shop.example.com"), /deadline/);
  assert.equal(cancelled, 1);
  const successful = createDomainTxtResolver({
    createResolver: () => ({
      resolveTxt: async () => [[input.ownershipValue]],
      cancel: () => {
        cancelled++;
      },
    }),
  });
  assert.deepEqual(await successful("_ecs-verification.shop.example.com"), [
    [input.ownershipValue],
  ]);
  assert.equal(cancelled, 2);
});

it("verifies exact chunked TXT and all ingress addresses without HTTP requests", async () => {
  const probe = createDomainDnsProbe({
    ingressAddresses: [ingress],
    createResolver: () => ({
      resolve4: async () => [ingress, ingress],
      resolve6: async () => [],
      resolveTxt: async (name) => {
        assert.equal(name, "_ecs-verification.shop.example.com");
        return [["ecs-domain-verification=", "token"]];
      },
      cancel: () => {},
    }),
  });
  assert.deepEqual(await probe(input), {
    ok: true,
    ownership: true,
    dns: "ready",
    addresses: [ingress],
    readyAddresses: [ingress],
  });
});

it("treats absent DNS records as missing but leaves transient resolver failures retryable", async () => {
  let code = "ENODATA";
  const probe = createDomainDnsProbe({
    ingressAddresses: [ingress],
    createResolver: () => ({
      resolve4: async () => [ingress],
      resolve6: async () => {
        throw Object.assign(new Error("Lookup failed"), { code });
      },
      resolveTxt: async () => {
        throw Object.assign(new Error("TXT absent"), { code: "ENOTFOUND" });
      },
      cancel: () => {},
    }),
  });
  assert.deepEqual(await probe(input), {
    ok: true,
    ownership: false,
    dns: "ready",
    addresses: [ingress],
    readyAddresses: [ingress],
  });
  code = "ESERVFAIL";
  assert.deepEqual(await probe(input), { ok: false, error: "dns_lookup_failed" });
});

it("rejects private, reserved and malformed answers and never pins mixed or foreign DNS", async () => {
  let addresses = [ingress];
  let ipv6: string[] = [];
  const probe = createDomainDnsProbe({
    ingressAddresses: [ingress],
    createResolver: () => ({
      resolve4: async () => addresses,
      resolve6: async () => ipv6,
      resolveTxt: async () => [[input.ownershipValue]],
      cancel: () => {},
    }),
  });
  for (const address of [
    "127.0.0.1",
    "10.0.0.1",
    "169.254.169.254",
    "100.64.1.2",
    "192.168.1.1",
    "192.0.2.1",
    "224.0.0.1",
    "not-an-ip",
  ]) {
    addresses = [ingress, address];
    const result = await probe(input);
    assert.ok(result.ok);
    if (!result.ok) continue;
    assert.equal(result.dns, "unsafe", address);
    assert.deepEqual(result.readyAddresses, []);
  }
  addresses = [ingress];
  for (const address of ["::1", "fe80::1", "fc00::1", "::ffff:127.0.0.1", "2001:db8::1"]) {
    ipv6 = [address];
    const result = await probe(input);
    assert.ok(result.ok && result.dns === "unsafe", address);
  }
  ipv6 = ["2606:4700:4700::1111"];
  const result = await probe(input);
  assert.ok(result.ok && result.dns === "missing");
  if (result.ok) assert.deepEqual(result.readyAddresses, []);
  for (const address of ["127.0.0.1", "192.0.2.1", "not-an-ip"]) {
    assert.throws(() => createDomainDnsProbe({ ingressAddresses: [address] }), /ingress/);
  }
});

it("bounds the whole lookup and cancels its independent resolver", async () => {
  let cancelled = false;
  const probe = createDomainDnsProbe({
    ingressAddresses: [ingress],
    timeoutMs: 10,
    createResolver: () => ({
      resolve4: async () => [ingress],
      resolve6: () => new Promise((resolve) => setTimeout(() => resolve([]), 60)),
      resolveTxt: async () => [[input.ownershipValue]],
      cancel: () => {
        cancelled = true;
      },
    }),
  });
  assert.deepEqual(await probe(input), { ok: false, error: "dns_lookup_failed" });
  assert.equal(cancelled, true);
});
