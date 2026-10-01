import assert from "node:assert/strict";
import { it } from "node:test";
import { renderDomainRoutes } from "./route-renderer.js";

const options = { service: "ecs-custom-storefront@file", resolver: "letsencrypt" };

it("renders canonical IDNA TLDs and rejects public/private suffix-only routes", () => {
  assert.match(
    renderDomainRoutes(["xn--fsqu00a.xn--fiqs8s"], options),
    /Host\(`xn--fsqu00a.xn--fiqs8s`\)/,
  );
  for (const hostname of ["co.uk", "github.io", "shop.invalid"])
    assert.throws(() => renderDomainRoutes([hostname], options), /hostname/);
});

it("renders exact HTTP redirects and managed HTTPS routes without certificate files", () => {
  const output = renderDomainRoutes(["shop.example.com"], options);
  assert.match(output, /Host\(`shop.example.com`\)/);
  assert.match(output, /entryPoints: \[web\]/);
  assert.match(output, /entryPoints: \[websecure\]/);
  assert.match(output, /certResolver: letsencrypt/);
  assert.match(output, /service: ecs-custom-storefront@file/);
  assert.match(output, /permanent: true/);
  assert.doesNotMatch(output, /HostRegexp|certificates:|privateKey|domains:/);
});

it("renders stable deduplicated snapshots and a valid no-router last-route removal", () => {
  assert.equal(
    renderDomainRoutes(["b.example.com", "a.example.com", "b.example.com"], options),
    renderDomainRoutes(["a.example.com", "b.example.com"], options),
  );
  const empty = renderDomainRoutes([], options);
  assert.doesNotMatch(empty, /routers:|Host\(|tls:|certificates:/);
  assert.match(empty, /redirectScheme:/);
});

it("rejects reserved platform hosts, wildcards and rule/configuration injection", () => {
  for (const hostname of [
    "*.example.com",
    "ecset.dev",
    "dashboard.ecset.dev",
    "shop.example.et",
    "127.0.0.1",
    "https://shop.example.com",
    "SHOP.example.com",
    "shop.example.com`) || Host(`evil.example.com",
    "bad..example.com",
    "app.ecs.example.com",
    "ecs.example.com",
  ]) {
    assert.throws(
      () =>
        renderDomainRoutes([hostname], {
          ...options,
          platformBaseDomain: "ecs.example.com",
        }),
      /hostname/,
    );
  }
  for (const unsafe of [
    { ...options, service: "backend" },
    { ...options, service: "backend@file\nhttp:" },
    { ...options, resolver: "name\nhttp:" },
    { ...options, platformBaseDomain: "https://ecs.example.com" },
  ])
    assert.throws(() => renderDomainRoutes(["shop.example.com"], unsafe));
});
