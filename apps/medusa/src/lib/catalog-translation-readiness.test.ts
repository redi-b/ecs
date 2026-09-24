import assert from "node:assert/strict";
import test from "node:test";
import {
  catalogTranslationReadinessQuerySchema,
  toProductTranslationReadiness,
  toShippingOptionTranslationReadiness,
  toTaxonomyTranslationReadiness,
} from "./catalog-translation-readiness";

test("accepts one sales channel from an HTTP query string", () => {
  const parsed = catalogTranslationReadinessQuerySchema.parse({
    locale: "am-ET",
    resource_type: "product",
    sales_channel_id: "sc_1",
    tenant_id: "tenant_1",
  });
  assert.deepEqual(parsed.sales_channel_id, ["sc_1"]);
});

test("classifies missing, partial, and complete product translations", () => {
  const source = { description: "Soft cotton", title: "Shirt" };
  const product = { id: "prod_1", title: source.title, description: source.description };
  assert.equal(toProductTranslationReadiness(product, "am-ET").status, "using_english");
  assert.equal(
    toProductTranslationReadiness(
      {
        ...product,
        translations: [{ locale_code: "am-ET", translations: { title: "ሸሚዝ" } }],
      },
      "am-ET",
    ).status,
    "needs_review",
  );
  assert.equal(
    toProductTranslationReadiness(
      {
        ...product,
        translations: [
          {
            locale_code: "am-ET",
            translations: {
              title: "ሸሚዝ",
              description: "ለስላሳ ጥጥ",
            },
          },
        ],
      },
      "am-ET",
    ).status,
    "ready",
  );
});

test("requires product options and values to be current without duplicating variant combinations", () => {
  const current = (_source: Record<string, string>, translations: Record<string, string>) => [
    {
      locale_code: "am-ET",
      translations,
    },
  ];
  const productSource = { title: "Shirt" };
  const optionSource = { title: "Color" };
  const valueSource = { value: "Blue" };
  const product = {
    id: "prod_1",
    title: productSource.title,
    translations: current(productSource, { title: "ሸሚዝ" }),
    options: [
      {
        id: "opt_1",
        title: optionSource.title,
        translations: current(optionSource, { title: "ቀለም" }),
        values: [
          {
            id: "optval_1",
            value: valueSource.value,
            translations: current(valueSource, { value: "ሰማያዊ" }),
          },
        ],
      },
    ],
    variants: [
      {
        id: "variant_1",
        title: "Blue shirt",
      },
    ],
  };

  const ready = toProductTranslationReadiness(product, "am-ET");
  assert.equal(ready.status, "ready");
  assert.equal(ready.translatedFields, 3);
  assert.equal(ready.totalFields, 3);

  const changedSource = structuredClone(product);
  const changedOptionValue = changedSource.options[0]?.values[0];
  assert.ok(changedOptionValue);
  changedOptionValue.value = "Navy";
  assert.equal(toProductTranslationReadiness(changedSource, "am-ET").status, "ready");

  const changedVariant = structuredClone(product);
  const changedVariantEntry = changedVariant.variants[0];
  assert.ok(changedVariantEntry);
  changedVariantEntry.title = "Navy shirt";
  assert.equal(toProductTranslationReadiness(changedVariant, "am-ET").status, "ready");
});

test("does not ask merchants to translate Medusa's synthetic default option", () => {
  const result = toProductTranslationReadiness(
    {
      id: "prod_simple",
      title: "Coffee",
      options: [
        {
          id: "opt_default",
          title: "Default option",
          values: [{ id: "optval_default", value: "Default option value" }],
        },
      ],
      variants: [{ id: "variant_default", title: "Default variant" }],
    },
    "am-ET",
  );

  assert.equal(result.totalFields, 1);
  assert.equal(result.translatedFields, 0);
});

test("classifies category and collection translations against their source", () => {
  const categorySource = { description: "Everyday essentials", name: "Essentials" };
  const category = {
    id: "pcat_1",
    ...categorySource,
    translations: [
      {
        locale_code: "am-ET",
        translations: {
          description: "የዕለት ተዕለት አስፈላጊ ምርቶች",
          name: "አስፈላጊ ምርቶች",
        },
      },
    ],
  };
  assert.equal(
    toTaxonomyTranslationReadiness(category, "am-ET", "product_category").status,
    "ready",
  );

  const changedSource = structuredClone(category);
  changedSource.name = "Daily essentials";
  assert.equal(
    toTaxonomyTranslationReadiness(changedSource, "am-ET", "product_category").status,
    "ready",
  );

  assert.equal(
    toTaxonomyTranslationReadiness(
      { id: "pcol_1", title: "New arrivals" },
      "am-ET",
      "product_collection",
    ).status,
    "using_english",
  );
});

test("classifies a shipping option translation", () => {
  const source = { name: "Local Delivery" };
  const option = {
    id: "so_1",
    ...source,
    translations: [
      {
        locale_code: "am-ET",
        translations: { name: "መላኪያ" },
      },
    ],
  };
  assert.equal(toShippingOptionTranslationReadiness(option, "am-ET").status, "ready");
});
