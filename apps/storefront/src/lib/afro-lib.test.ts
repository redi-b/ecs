import assert from "node:assert/strict";
import test from "node:test";
import { afroV1Defaults } from "@ecs/storefront-templates";
import { parseAfroData } from "../templates/afro/v1/lib.js";

test("preserves saved Afro copy instead of silently replacing it at render time", () => {
  const data = structuredClone(afroV1Defaults);
  data.home.hero.title = "Custom headline for Afro Studio";

  const parsed = parseAfroData(data);

  assert.equal(parsed.home.hero.title, "Custom headline for Afro Studio");
});
