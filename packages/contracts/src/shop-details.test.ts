import assert from "node:assert/strict";
import test from "node:test";
import {
  formatShopAddress,
  normalizeEthiopianPhone,
  normalizeShopSocialProfileUrl,
  shopDetailsSchema,
} from "./index.js";

test("normalizes familiar Ethiopian phone notation", () => {
  for (const value of ["0912 345 678", "+251 912 345 678", "251912345678", "00251912345678"]) {
    assert.equal(normalizeEthiopianPhone(value), "+251912345678");
  }
  assert.equal(
    shopDetailsSchema.safeParse({
      version: 1,
      categories: ["Fashion"],
      description: "",
      primaryPhone: "0912345678",
      additionalPhones: [],
      publicEmail: "",
      socialProfiles: [],
    }).success,
    true,
  );
});

test("address display preserves meaningful landmarks without duplicating city and region", () => {
  assert.equal(
    formatShopAddress({
      city: "Addis Ababa",
      region: "Addis Ababa",
      subcity: "Bole",
      woreda: "03",
      area: "Atlas",
      streetAddress: "Example building",
      landmark: "Opposite the pharmacy",
      directions: "Side entrance",
    }),
    "Example building · Atlas · 03 · Bole · Addis Ababa · Opposite the pharmacy · Side entrance",
  );
  assert.equal(
    formatShopAddress({ city: "Adama", streetAddress: "Main street", directions: "" }, "\n"),
    "Main street\nAdama",
  );
  assert.equal(formatShopAddress(undefined), "");
});

test("rejects duplicate phones and links that impersonate a social host", () => {
  const base = {
    version: 1,
    categories: ["Fashion"],
    description: "",
    primaryPhone: "0912345678",
    additionalPhones: [],
    publicEmail: "",
    socialProfiles: [],
  };
  assert.equal(
    shopDetailsSchema.safeParse({ ...base, additionalPhones: ["+251912345678"] }).success,
    false,
  );
  assert.equal(
    shopDetailsSchema.safeParse({
      ...base,
      socialProfiles: [{ platform: "instagram", url: "https://instagram.com.example.org/shop" }],
    }).success,
    false,
  );
  assert.equal(
    shopDetailsSchema.safeParse({
      ...base,
      socialProfiles: [{ platform: "instagram", url: "https://www.instagram.com/shop" }],
    }).success,
    true,
  );
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

test("accepts restrained document branding and rejects unsafe values", () => {
  const base = {
    additionalPhones: [],
    categories: ["Fashion"],
    description: "",
    primaryPhone: "0912345678",
    publicEmail: "",
    socialProfiles: [],
    version: 1,
  };
  assert.equal(
    shopDetailsSchema.safeParse({
      ...base,
      documentBranding: {
        accentColor: "#0f766e",
        footerNote: "Thank you.",
        logoUrl: "https://cdn.example.com/logo.png",
        showContactDetails: true,
      },
    }).success,
    true,
  );
  assert.equal(
    shopDetailsSchema.safeParse({
      ...base,
      documentBranding: {
        accentColor: "teal",
        footerNote: "",
        logoUrl: "javascript:alert(1)",
        showContactDetails: true,
      },
    }).success,
    false,
  );
});

test("manual Ethiopian address details survive shop contract validation", () => {
  const address = {
    city: "Addis Ababa",
    region: "Addis Ababa",
    subcity: "Bole",
    woreda: "03",
    area: "Atlas",
    streetAddress: "First floor, Example building",
    landmark: "Opposite the pharmacy",
    directions: "Use the side entrance",
  };
  const result = shopDetailsSchema.safeParse({
    version: 1,
    categories: ["Fashion"],
    primaryPhone: "0912345678",
    address,
  });
  assert.equal(result.success, true);
  if (result.success) assert.deepEqual(result.data.address, address);
});
