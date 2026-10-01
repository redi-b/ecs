import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { renderDomainRoutes } from "./custom-domain-routing.mjs";

const options = { service: "ecs-custom-storefront@file", resolver: "ecs-domains-staging" };

test("production gateway opts out of Docker default routers and uses a stable file-provider backend", () => {
  const compose = readFileSync(
    new URL("../infra/dokploy/custom-domains.compose.yml", import.meta.url),
    "utf8",
  );
  assert.match(compose, /traefik\.enable=false/);
  assert.doesNotMatch(compose, /traefik\.http\./);
  assert.match(compose, /aliases: \[ecs-custom-domain-gateway\]/);
  const backend = readFileSync(
    new URL("../infra/dokploy/custom-domains/backend.yml", import.meta.url),
    "utf8",
  );
  assert.match(backend, /url: http:\/\/ecs-custom-domain-gateway:8080/);
  assert.match(backend, /passHostHeader: true/);
});

test("renders exact HTTP redirect and HTTPS routes with explicit backend and resolver", () => {
  const output = renderDomainRoutes(["shop.example.com"], options);
  assert.match(output, /Host\(`shop.example.com`\)/);
  assert.match(output, /entryPoints: \[web\]/);
  assert.match(output, /entryPoints: \[websecure\]/);
  assert.match(output, /certResolver: ecs-domains-staging/);
  assert.match(output, /service: ecs-custom-storefront@file/);
  assert.match(output, /permanent: true/);
  assert.doesNotMatch(output, /HostRegexp|certificates:|privateKey|domains:/);
});

test("output is deterministic and deduplicates hostnames", () => {
  assert.equal(
    renderDomainRoutes(["b.example.com", "a.example.com", "b.example.com"], options),
    renderDomainRoutes(["a.example.com", "b.example.com"], options),
  );
});

test("rejects wildcard, platform, unsupported and rule-injection hosts", () => {
  for (const host of [
    "*.example.com",
    "app.ecset.dev",
    "ecset.dev",
    "shop.example.et",
    "127.0.0.1",
    "shop.example.com`) || Host(`evil.example.com",
    "https://shop.example.com",
    "SHOP.example.com",
  ]) {
    assert.throws(() => renderDomainRoutes([host], options), /hostname/);
  }
});

test("requires explicit safe provider-qualified backend and resolver", () => {
  for (const input of [
    {},
    { ...options, service: "ecs-caddy" },
    { ...options, resolver: "x\nhttp:" },
  ]) {
    assert.throws(() => renderDomainRoutes(["shop.example.com"], input));
  }
});

test("empty desired set withdraws all routes without touching certificates", () => {
  const output = renderDomainRoutes([], options);
  assert.doesNotMatch(output, /routers:|Host\(|tls:|certificates:/);
  assert.match(output, /redirectScheme:/);
});
