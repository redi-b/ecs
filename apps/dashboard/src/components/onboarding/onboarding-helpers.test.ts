import assert from "node:assert/strict";
import test from "node:test";
import type { StorefrontTemplateCatalogItem } from "@ecs/contracts";

import { getRecommendedTemplateKey, sanitizeHandleDraft, slugify } from "./onboarding-helpers.js";

const templates = [
  { version: { templateKey: "luvia@1" } },
  { version: { templateKey: "nexahub@1" } },
] as StorefrontTemplateCatalogItem[];

test("preserves a trailing handle hyphen while the merchant is typing", () => {
  assert.equal(sanitizeHandleDraft("Addis-"), "addis-");
  assert.equal(slugify(sanitizeHandleDraft("Addis-")), "addis");
});

test("recommends a relevant template without manufacturing a recommendation", () => {
  assert.equal(getRecommendedTemplateKey(["Fashion"], templates), "luvia@1");
  assert.equal(getRecommendedTemplateKey(["Electronics"], templates), "nexahub@1");
  assert.equal(getRecommendedTemplateKey(["Groceries"], templates), null);
});
