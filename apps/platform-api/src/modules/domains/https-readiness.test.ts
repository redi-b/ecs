import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import type { ClientRequest, IncomingMessage } from "node:http";
import { Readable } from "node:stream";
import { it } from "node:test";
import { createDomainHttpsProbe, type DomainProbeRequest } from "./https-readiness.js";

const input = {
  hostname: "shop.example.com",
  tenantId: "2cbb145b-f0f1-4b1d-8d38-f0a279d61098",
  domainId: "3ff3d6e4-a77b-4fc9-aa44-2cf9966acb02",
};
const ingress = "178.238.224.27";

function responseRequest(
  status: number,
  body: (nonce: string) => string,
  contentType = "application/json",
): DomainProbeRequest {
  return (options, callback) => {
    const response = Readable.from([
      body(String(options.headers?.["x-ecs-domain-probe"])),
    ]) as IncomingMessage;
    response.statusCode = status;
    response.headers = { "content-type": contentType };
    const outgoing = new EventEmitter() as ClientRequest;
    outgoing.end = () => {
      queueMicrotask(() => callback(response));
      return outgoing;
    };
    outgoing.destroy = () => outgoing;
    return outgoing;
  };
}

it("pins ingress with verified TLS, original SNI/Host and fresh expected-shop identity", async () => {
  const fakeRequest: DomainProbeRequest = (options, callback) => {
    assert.equal(options.hostname, ingress);
    assert.equal(options.port, 443);
    assert.equal(options.servername, input.hostname);
    assert.equal(options.headers?.Host, input.hostname);
    assert.equal(options.rejectUnauthorized, true);
    assert.ok(
      Array.isArray(options.ca) && options.ca.length > 0,
      "Use bundled public roots, not ambient private trust",
    );
    assert.equal(
      options.checkServerIdentity?.(input.hostname, {
        subjectaltname: `DNS:${input.hostname}`,
        subject: { CN: input.hostname },
      } as never),
      undefined,
    );
    assert.ok(
      options.checkServerIdentity?.(input.hostname, {
        subjectaltname: "DNS:different.example.com",
        subject: { CN: "different.example.com" },
      } as never) instanceof Error,
    );
    assert.equal(options.agent, false);
    assert.equal(options.path, "/.well-known/ecs-domain-verification");
    const nonce = options.headers?.["x-ecs-domain-probe"];
    assert.equal(typeof nonce, "string");
    if (typeof nonce !== "string") throw new Error("Missing nonce");
    assert.match(nonce, /^[a-f0-9]{32}$/);
    const response = Readable.from([
      JSON.stringify({ ...input, nonce, version: 1 }),
    ]) as IncomingMessage;
    response.statusCode = 200;
    response.headers = { "content-type": "application/json" };
    const outgoing = new EventEmitter() as ClientRequest;
    outgoing.end = () => {
      queueMicrotask(() => callback(response));
      return outgoing;
    };
    outgoing.destroy = () => outgoing;
    return outgoing;
  };
  const probe = createDomainHttpsProbe({ ingressAddresses: [ingress], request: fakeRequest });
  assert.deepEqual(await probe(input), { ok: true, https: "valid" });
});

it("bounds slow or oversized responses and keeps network errors retryable without weakening TLS", async () => {
  const oversized = createDomainHttpsProbe({
    ingressAddresses: [ingress],
    request: responseRequest(200, (nonce) =>
      JSON.stringify({ ...input, nonce, version: 1, padding: "x".repeat(5000) }),
    ),
  });
  assert.deepEqual(await oversized(input), { ok: true, https: "invalid" });
  let destroyed = false;
  const slow = createDomainHttpsProbe({
    ingressAddresses: [ingress],
    timeoutMs: 10,
    request: (options, callback) => {
      const outgoing = new EventEmitter() as ClientRequest;
      let timer: ReturnType<typeof setTimeout>;
      outgoing.end = () => {
        timer = setTimeout(() => {
          const response = Readable.from([
            JSON.stringify({
              ...input,
              nonce: options.headers?.["x-ecs-domain-probe"],
              version: 1,
            }),
          ]) as IncomingMessage;
          response.statusCode = 200;
          response.headers = { "content-type": "application/json" };
          callback(response);
        }, 50);
        return outgoing;
      };
      outgoing.destroy = () => {
        destroyed = true;
        clearTimeout(timer);
        return outgoing;
      };
      return outgoing;
    },
  });
  assert.deepEqual(await slow(input), { ok: false, error: "https_probe_failed" });
  assert.equal(destroyed, true);
  let code = "ECONNRESET";
  const failing = createDomainHttpsProbe({
    ingressAddresses: [ingress],
    request: () => {
      const outgoing = new EventEmitter() as ClientRequest;
      outgoing.end = () => {
        queueMicrotask(() =>
          outgoing.emit("error", Object.assign(new Error("Request failed"), { code })),
        );
        return outgoing;
      };
      outgoing.destroy = () => outgoing;
      return outgoing;
    },
  });
  assert.deepEqual(await failing(input), { ok: false, error: "https_probe_failed" });
  code = "CERT_HAS_EXPIRED";
  assert.deepEqual(await failing(input), { ok: true, https: "invalid" });
  assert.throws(() => createDomainHttpsProbe({ ingressAddresses: ["127.0.0.1"] }), /ingress/);
});

it("distinguishes missing endpoint, wrong-shop identity, stale responses and temporary server failure", async () => {
  const cases = [
    { status: 404, body: () => "Not found", expected: { ok: true, https: "pending" } },
    {
      status: 503,
      body: () => "Unavailable",
      expected: { ok: false, error: "https_probe_failed" },
    },
    {
      status: 200,
      body: (nonce: string) =>
        JSON.stringify({
          ...input,
          tenantId: "ada0b726-2e84-48e4-a3bb-4f4f443c3d03",
          nonce,
          version: 1,
        }),
      expected: { ok: true, https: "wrong_shop" },
    },
    {
      status: 200,
      body: () => JSON.stringify({ ...input, nonce: "cached", version: 1 }),
      expected: { ok: true, https: "invalid" },
    },
    { status: 308, body: () => "Redirect", expected: { ok: true, https: "invalid" } },
  ];
  for (const entry of cases) {
    const probe = createDomainHttpsProbe({
      ingressAddresses: [ingress],
      request: responseRequest(entry.status, entry.body),
    });
    assert.deepEqual(await probe(input), entry.expected);
  }
  const html = createDomainHttpsProbe({
    ingressAddresses: [ingress],
    request: responseRequest(
      200,
      (nonce) => JSON.stringify({ ...input, nonce, version: 1 }),
      "text/html",
    ),
  });
  assert.deepEqual(await html(input), { ok: true, https: "invalid" });
});

it("checks every selected ingress snapshot and rejects attempts to probe unconfigured addresses", async () => {
  const checked: string[] = [];
  const transport = responseRequest(200, (nonce) =>
    JSON.stringify({ ...input, nonce, version: 1 }),
  );
  const probe = createDomainHttpsProbe({
    ingressAddresses: [ingress, "178.238.224.28"],
    request: (options, callback) => {
      checked.push(String(options.hostname));
      return transport(options, callback);
    },
  });
  assert.deepEqual(await probe(input), { ok: true, https: "valid" });
  assert.deepEqual(checked, [ingress, "178.238.224.28"]);
  checked.length = 0;
  await assert.rejects(probe({ ...input, addresses: ["127.0.0.1"] }), /ingress/);
  assert.deepEqual(checked, []);
  assert.deepEqual(await probe({ ...input, addresses: [ingress] }), { ok: true, https: "valid" });
  assert.deepEqual(checked, [ingress]);
});
