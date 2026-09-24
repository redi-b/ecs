import assert from "node:assert/strict";
import test from "node:test";

import { createMedusaCatalogTranslationService } from "./catalog-translation-service.js";

function requestUrl(input: Parameters<typeof fetch>[0]) {
  if (typeof input === "string") return new URL(input);
  if (input instanceof URL) return input;
  return new URL(input.url);
}

test("reads and writes a tenant-owned product option translation", async () => {
  let stored: { id: string; translations: Record<string, string> } | null = null;
  let batchBody: unknown;
  let synchronizedProductIds: string[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = requestUrl(input);
    if (url.pathname === "/admin/products/prod_1") {
      return Response.json({
        product: {
          id: "prod_1",
          title: "Shirt",
          sales_channels: [{ id: "sc_1" }],
          options: [{ id: "opt_color", title: "Color", values: [] }],
          variants: [],
        },
      });
    }
    if (url.pathname === "/admin/translations" && init?.method !== "POST") {
      return Response.json({ translations: stored ? [stored] : [], count: stored ? 1 : 0 });
    }
    if (url.pathname === "/admin/translations/batch") {
      batchBody = JSON.parse(String(init?.body));
      const create = (batchBody as { create: Array<{ translations: Record<string, string> }> })
        .create[0];
      assert.ok(create);
      stored = { id: "trans_1", translations: create.translations };
      return Response.json({ created: [stored], updated: [], deleted: { ids: [] } });
    }
    if (url.pathname === "/admin/product-search") {
      synchronizedProductIds = (JSON.parse(String(init?.body)) as { ids: string[] }).ids;
      return Response.json({ accepted: synchronizedProductIds.length }, { status: 202 });
    }
    return Response.json({}, { status: 404 });
  };
  const service = createMedusaCatalogTranslationService({
    adminApiToken: "token",
    fetcher,
    medusaInternalUrl: "http://medusa.test",
  });

  const before = await service.read({
    locale: "am",
    productId: "prod_1",
    resourceId: "opt_color",
    resourceType: "product_option",
    salesChannelId: "sc_1",
    tenantId: "tenant_1",
  });
  assert.equal(before.ok && before.resource.status, "using_english");

  const saved = await service.write({
    locale: "am",
    productId: "prod_1",
    resourceId: "opt_color",
    resourceType: "product_option",
    salesChannelId: "sc_1",
    tenantId: "tenant_1",
    translations: { title: "ቀለም" },
  });

  assert.equal(saved.ok && saved.resource.status, "ready");
  assert.deepEqual(saved.ok && saved.resource.translations, { title: "ቀለም" });
  assert.equal(
    (batchBody as { create: Array<{ reference: string }> }).create[0]?.reference,
    "product_option",
  );
  assert.deepEqual(synchronizedProductIds, ["prod_1"]);
});

test("reads and writes a product translation bundle with bounded Medusa requests", async () => {
  const requests: string[] = [];
  const service = createMedusaCatalogTranslationService({
    adminApiToken: "token",
    medusaInternalUrl: "http://medusa.test",
    fetcher: async (input, init) => {
      const url = requestUrl(input);
      requests.push(`${init?.method ?? "GET"} ${url.pathname}`);
      if (url.pathname === "/admin/products/prod_1") {
        return Response.json({
          product: {
            id: "prod_1",
            title: "Shirt",
            description: "Soft cotton",
            sales_channels: [{ id: "sc_1" }],
            options: [
              {
                id: "opt_color",
                title: "Color",
                values: [{ id: "optval_blue", value: "Blue" }],
              },
            ],
            variants: [],
          },
        });
      }
      if (url.pathname === "/admin/translations") {
        return Response.json({ translations: [], count: 0 });
      }
      if (url.pathname === "/admin/translations/batch") {
        return Response.json({ created: [], updated: [], deleted: { ids: [] } });
      }
      if (url.pathname === "/admin/product-search") {
        return Response.json({ accepted: 1 }, { status: 202 });
      }
      return Response.json({}, { status: 404 });
    },
  });
  const items = [
    { resourceId: "prod_1", resourceType: "product" as const },
    { productId: "prod_1", resourceId: "opt_color", resourceType: "product_option" as const },
    {
      productId: "prod_1",
      resourceId: "optval_blue",
      resourceType: "product_option_value" as const,
    },
  ].map((item) => ({
    ...item,
    locale: "am" as const,
    salesChannelId: "sc_1",
    tenantId: "tenant_1",
  }));

  const loaded = await service.readMany(items);
  assert.equal(loaded.ok && loaded.resources.length, 3);
  assert.deepEqual(requests, ["GET /admin/products/prod_1", "GET /admin/translations"]);

  requests.length = 0;
  const saved = await service.writeMany(
    items.map((item) => ({
      ...item,
      translations:
        item.resourceType === "product_option_value" ? { value: "ሰማያዊ" } : { title: "ትርጉም" },
    })),
  );
  assert.equal(saved.ok && saved.resources.length, 3);
  assert.deepEqual(requests, [
    "GET /admin/products/prod_1",
    "GET /admin/translations",
    "POST /admin/translations/batch",
    "POST /admin/product-search",
  ]);
});

test("does not expose a product from another sales channel", async () => {
  let translationRequested = false;
  const service = createMedusaCatalogTranslationService({
    adminApiToken: "token",
    medusaInternalUrl: "http://medusa.test",
    fetcher: async (input) => {
      const url = requestUrl(input);
      if (url.pathname === "/admin/translations") translationRequested = true;
      return Response.json({
        product: {
          id: "prod_1",
          title: "Private product",
          sales_channels: [{ id: "sc_other" }],
        },
      });
    },
  });
  const result = await service.read({
    locale: "am",
    resourceId: "prod_1",
    resourceType: "product",
    salesChannelId: "sc_1",
    tenantId: "tenant_1",
  });
  assert.deepEqual(result, {
    ok: false,
    error: "catalog_translation_not_found",
    status: 404,
  });
  assert.equal(translationRequested, false);
});

test("lists tenant-scoped product translation readiness", async () => {
  let requestedUrl: URL | undefined;
  const service = createMedusaCatalogTranslationService({
    adminApiToken: "token",
    medusaInternalUrl: "http://medusa.test",
    fetcher: async (input) => {
      requestedUrl = requestUrl(input);
      return Response.json({
        items: [
          {
            resourceId: "prod_1",
            title: "Shirt",
            status: "using_english",
            translatedFields: 0,
            totalFields: 2,
          },
        ],
        count: 1,
        ready: 0,
        needsReview: 0,
        usingEnglish: 1,
        limit: 5,
        offset: 0,
      });
    },
  });
  const result = await service.readiness({
    locale: "am",
    resourceType: "product",
    salesChannelId: "sc_1",
    tenantId: "tenant_1",
    limit: 5,
    offset: 0,
  });
  assert.equal(result.ok && result.queue.usingEnglish, 1);
  assert.equal(requestedUrl?.pathname, "/admin/platform-translation-readiness");
  assert.equal(requestedUrl?.searchParams.get("sales_channel_id"), "sc_1");
  assert.equal(requestedUrl?.searchParams.get("locale"), "am-ET");
  assert.equal(requestedUrl?.searchParams.get("resource_type"), "product");
  assert.equal(requestedUrl?.searchParams.get("tenant_id"), "tenant_1");
});

test("reads and writes only the tenant delivery option translation", async () => {
  let createdReference: string | undefined;
  let stored: { id: string; translations: Record<string, string> } | null = null;
  const service = createMedusaCatalogTranslationService({
    adminApiToken: "token",
    medusaInternalUrl: "http://medusa.test",
    fetcher: async (input, init) => {
      const url = requestUrl(input);
      if (url.pathname === "/admin/shipping-options/so_delivery") {
        return Response.json({ shipping_option: { id: "so_delivery", name: "Local Delivery" } });
      }
      if (url.pathname === "/admin/translations" && init?.method !== "POST") {
        return Response.json({ translations: stored ? [stored] : [], count: stored ? 1 : 0 });
      }
      if (url.pathname === "/admin/translations/batch") {
        const body = JSON.parse(String(init?.body)) as {
          create: Array<{ reference: string; translations: Record<string, string> }>;
        };
        createdReference = body.create[0]?.reference;
        const create = body.create[0];
        assert.ok(create);
        stored = { id: "trans_shipping", translations: create.translations };
        return Response.json({ created: [stored], updated: [], deleted: { ids: [] } });
      }
      return Response.json({}, { status: 404 });
    },
  });
  const denied = await service.read({
    locale: "am",
    resourceId: "so_other",
    resourceType: "shipping_option",
    salesChannelId: "sc_1",
    shippingOptionId: "so_delivery",
    tenantId: "tenant_1",
  });
  assert.equal(denied.ok, false);

  const saved = await service.write({
    locale: "am",
    resourceId: "so_delivery",
    resourceType: "shipping_option",
    salesChannelId: "sc_1",
    shippingOptionId: "so_delivery",
    tenantId: "tenant_1",
    translations: { name: "መላኪያ" },
  });
  assert.equal(saved.ok && saved.resource.status, "ready");
  assert.equal(createdReference, "shipping_option");

  const readiness = await service.readiness({
    locale: "am",
    resourceType: "shipping_option",
    salesChannelId: "sc_1",
    shippingOptionId: "so_delivery",
    tenantId: "tenant_1",
    limit: 1,
    offset: 0,
  });
  assert.equal(readiness.ok && readiness.queue.ready, 1);
  assert.equal(readiness.ok && readiness.queue.items[0]?.status, "ready");
});
