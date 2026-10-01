import assert from "node:assert/strict";
import test from "node:test";
import { snapshotMerchantDocumentBranding } from "./merchant-document-branding.js";

test("freezes restrained public document branding without private account data", () => {
  assert.deepEqual(
    snapshotMerchantDocumentBranding({
      additionalPhones: [],
      address: {
        city: "Addis Ababa",
        directions: "Near Meskel Square",
        streetAddress: "Bole",
        landmark: "Blue gate",
      },
      brand: { presetId: "teal" },
      categories: ["Retail"],
      description: "",
      documentBranding: {
        accentColor: "#123456",
        footerNote: "Thank you for choosing us.",
        logoUrl: "https://cdn.example.com/logo.png",
        showContactDetails: true,
      },
      primaryPhone: "+251911234567",
      publicEmail: "hello@example.com",
      socialProfiles: [],
      version: 1,
    }),
    {
      accentColor: "#123456",
      address: "Bole · Addis Ababa · Blue gate · Near Meskel Square",
      email: "hello@example.com",
      footerNote: "Thank you for choosing us.",
      logoUrl: "https://cdn.example.com/logo.png",
      phone: "+251911234567",
    },
  );
});

test("contact visibility is explicit and the existing brand supplies a safe default accent", () => {
  const branding = snapshotMerchantDocumentBranding({
    additionalPhones: [],
    brand: { presetId: "rose" },
    categories: ["Retail"],
    description: "",
    documentBranding: {
      accentColor: "#be123c",
      footerNote: "",
      logoUrl: "",
      showContactDetails: false,
    },
    primaryPhone: "+251911234567",
    publicEmail: "hello@example.com",
    socialProfiles: [],
    version: 1,
  });
  assert.equal(branding.accentColor, "#be123c");
  assert.equal(branding.phone, null);
  assert.equal(branding.email, null);
});
