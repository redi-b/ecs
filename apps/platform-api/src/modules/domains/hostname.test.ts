import assert from "node:assert/strict";
import { test } from "node:test";
import { isValidCustomDomainHostname, normalizeCustomDomainHostname } from "./service.js";

test("custom-domain input canonicalizes IDNA but rejects suffixes, URLs and private network names", () => {
  assert.equal(normalizeCustomDomainHostname("  BÜCHER.de.  "), "xn--bcher-kva.de");
  for (const input of [
    "https://shop.example.com",
    "shop.example.com/path",
    "shop.example.com:443",
    "shop\u0000.example.com",
  ])
    assert.equal(normalizeCustomDomainHostname(input), "");
  for (const hostname of [
    "shop.example.com",
    "example.co.uk",
    "xn--bcher-kva.de",
    "store.myshop.com",
  ])
    assert.equal(isValidCustomDomainHostname(hostname), true, hostname);
  for (const hostname of [
    "co.uk",
    "github.io",
    "com",
    "shop.invalid",
    "shop.local",
    "127.0.0.1",
    "https://shop.example.com",
    "shop.example.com:443",
    "*.example.com",
    "a..example.com",
    "shop.example.com/path",
    "shop.example.com\n",
  ])
    assert.equal(isValidCustomDomainHostname(hostname), false, hostname);
});
