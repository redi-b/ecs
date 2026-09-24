import assert from "node:assert/strict";
import test from "node:test";
import { ethiopianPhoneSchema, shopDetailsSchema, shopSocialProfileSchema } from "@ecs/contracts";

test("Ethiopian contact numbers normalize local, pasted international and fixed-line notation", () => {
  for (const value of ["091 234 5678", "912345678", "+251 91 234 5678", "00251-91-234-5678", "251912345678", "+251 (0)91 234 5678"]) {
    assert.equal(ethiopianPhoneSchema.parse(value), "+251912345678");
  }
  assert.equal(ethiopianPhoneSchema.parse("0111234567"), "+251111234567");
  for (const value of ["", "091234", "+12345678901", "09123456789", "09123abc78"]) {
    assert.equal(ethiopianPhoneSchema.safeParse(value).success, false);
  }
});

test("public shop details reject duplicate normalized phones without requiring public email or address", () => {
  const details = { version: 1, categories: ["Fashion"], primaryPhone: "0912345678" };
  assert.equal(shopDetailsSchema.parse(details).publicEmail, "");
  assert.equal(shopDetailsSchema.safeParse({ ...details, additionalPhones: ["+251912345678"] }).success, false);
});

test("social profiles validate platform boundaries, secure URLs and duplicates", () => {
  assert.equal(shopSocialProfileSchema.safeParse({ platform: "instagram", url: "https://www.instagram.com/myshop/" }).success, true);
  assert.equal(shopSocialProfileSchema.parse({ platform: "instagram", url: "http://instagram.com/shop" }).url, "https://instagram.com/shop");
  for (const url of ["not a url", "https://instagram.com.evil.example/shop", "https://facebook.com/shop", "ftp://instagram.com/shop", "https://user:password@instagram.com/shop"]) {
    assert.equal(shopSocialProfileSchema.safeParse({ platform: "instagram", url }).success, false);
  }
  const profile = { platform: "instagram", url: "https://instagram.com/myshop" };
  assert.equal(shopDetailsSchema.safeParse({ version: 1, categories: ["Fashion"], primaryPhone: "0912345678", socialProfiles: [profile, profile] }).success, false);
});
