import assert from "node:assert/strict";
import test from "node:test";

import { z } from "zod";

import { buildPlatformSeed } from "./seed-data.js";

test("buildPlatformSeed creates the default local tenant context", () => {
  const seed = buildPlatformSeed({
    storefrontBaseDomain: "lvh.me",
    medusaPublishableKeyId: "pk_test_local",
    templates: [
      {
        slug: "classic",
        name: "Classic",
        description: "Classic storefront.",
        version: 1,
        templateKey: "classic@1",
        schema: z.object({ title: z.string() }),
        defaultData: { title: "Hello" },
        defaultThemeTokens: { radius: "sm" },
      },
    ],
  });

  assert.equal(seed.tenant.handle, "abebe");
  assert.equal(seed.domain.hostname, "abebe.lvh.me");
  assert.equal(seed.tenant.medusaPublishableKeyId, "pk_test_local");
  assert.equal(seed.user.email, "owner@abebe.local");
  assert.equal(seed.tenantMembership.role, "owner");
  assert.equal(seed.templateVersions[0]?.schema.type, "object");
  assert.deepEqual(seed.storefrontRevision.data, { title: "Hello" });
  assert.equal(seed.storefrontRevision.templateKey, "classic@1");
});

test("buildPlatformSeed normalizes base domain and publishable key input", () => {
  const seed = buildPlatformSeed({
    storefrontBaseDomain: " LVH.ME. ",
    medusaPublishableKeyId: " pk_test_trimmed ",
    templates: [
      {
        slug: "classic",
        name: "Classic",
        description: "Classic storefront.",
        version: 1,
        templateKey: "classic@1",
        schema: z.object({ title: z.string() }),
        defaultData: { title: "Hello" },
        defaultThemeTokens: { radius: "sm" },
      },
    ],
  });

  assert.equal(seed.domain.hostname, "abebe.lvh.me");
  assert.equal(seed.tenant.medusaPublishableKeyId, "pk_test_trimmed");
});
