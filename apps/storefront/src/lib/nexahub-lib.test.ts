import assert from "node:assert/strict";
import test from "node:test";
import { nexahubV1Defaults } from "@ecs/storefront-templates";
import { parseNexahubData } from "../templates/nexahub/v1/lib.js";

test("preserves saved NexaHub copy instead of silently replacing it at render time", () => {
  const data = structuredClone(nexahubV1Defaults);
  data.home.hero.title = "Upgrade your everyday tech";
  data.home.hero.body = "Merchant-written description";

  const parsed = parseNexahubData(data);

  assert.equal(parsed.home.hero.title, "Upgrade your everyday tech");
  assert.equal(parsed.home.hero.body, "Merchant-written description");
});
