import assert from "node:assert/strict";
import test from "node:test";

import { attachCatalogNameTranslations } from "./attach-catalog-name-translations.js";

test("fills empty translation summaries when the lookup is missing", async () => {
  const [item] = await attachCatalogNameTranslations({
    items: [{ id: "prod_1", title: "Shirt" }],
    resourceType: "product",
  });
  assert.deepEqual(item?.translation, {
    locale: "am",
    status: "using_english",
    title: null,
  });
});

test("attaches summaries from the lookup by id", async () => {
  const [item] = await attachCatalogNameTranslations({
    items: [{ id: "prod_1", title: "Shirt" }],
    resourceType: "product",
    summarizeNames: async () =>
      new Map([
        [
          "prod_1",
          { locale: "am", status: "ready", title: "ሸሚዝ" },
        ],
      ]),
  });
  assert.equal(item?.translation?.title, "ሸሚዝ");
  assert.equal(item?.translation?.status, "ready");
});
