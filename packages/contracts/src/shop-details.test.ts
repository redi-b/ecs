import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeEthiopianPhone,
  normalizeShopSocialProfileUrl,
  shopDetailsSchema,
} from "./index.js";

test("normalizes familiar Ethiopian phone notation", () => {
  for (const value of ["0912 345 678", "+251 912 345 678", "251912345678", "00251912345678"]) {
    assert.equal(normalizeEthiopianPhone(value), "+251912345678");
  }
  assert.equal(shopDetailsSchema.safeParse({ version: 1, categories: ["Fashion"], description: "", primaryPhone: "0912345678", additionalPhones: [], publicEmail: "", socialProfiles: [] }).success, true);
});

test("rejects duplicate phones and links that impersonate a social host", () => {
  const base = { version: 1, categories: ["Fashion"], description: "", primaryPhone: "0912345678", additionalPhones: [], publicEmail: "", socialProfiles: [] };
  assert.equal(shopDetailsSchema.safeParse({ ...base, additionalPhones: ["+251912345678"] }).success, false);
  assert.equal(shopDetailsSchema.safeParse({ ...base, socialProfiles: [{ platform: "instagram", url: "https://instagram.com.example.org/shop" }] }).success, false);
  assert.equal(shopDetailsSchema.safeParse({ ...base, socialProfiles: [{ platform: "instagram", url: "https://www.instagram.com/shop" }] }).success, true);
});

test("normalizes familiar social usernames and pasted links", () => {
  assert.equal(
    normalizeShopSocialProfileUrl("instagram", "@bole_style"),
    "https://instagram.com/bole_style",
  );
  assert.equal(
    normalizeShopSocialProfileUrl("whatsapp", "0912 345 678"),
    "https://wa.me/251912345678",
  );
  assert.equal(
    normalizeShopSocialProfileUrl("facebook", "https://www.facebook.com/bole.style/"),
    "https://www.facebook.com/bole.style/",
  );
});
