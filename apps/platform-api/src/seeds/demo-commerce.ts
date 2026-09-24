import { addDays, demoAddress } from "./demo-platform-data.js";
import {
  type DemoProduct,
  type DemoShopDefinition,
  demoProductImages,
  DEMO_SEED_MARKER,
} from "./demo-shops.js";
import type { createDemoCleanup } from "./demo-cleanup.js";
import type { createDemoMediaSeeder } from "./demo-media.js";
import type { createDemoMedusaClient } from "./demo-medusa-client.js";

type CommerceResources = {
  fulfillmentSetId: string;
  publishableKeyId: string;
  regionId: string;
  salesChannelId: string;
  serviceZoneId: string;
  shippingOptionId: string;
  shippingProfileId: string;
  stockLocationId: string;
  storeId: string;
};

type ProductSeedResult = {
  id: string;
  title: string;
  variants?: Array<{ id: string; title: string; sku?: string | null }>;
};

type DemoCommerceSeederOptions = {
  cleanup: ReturnType<typeof createDemoCleanup>;
  media: ReturnType<typeof createDemoMediaSeeder>;
  medusa: ReturnType<typeof createDemoMedusaClient>;
};

export function createDemoCommerceSeeder(options: DemoCommerceSeederOptions) {
  const demoCleanup = options.cleanup;
  const demoMedia = options.media;
  const demoMedusa = options.medusa;

  function toCommerceResources(
    row:
      | {
          medusaFulfillmentSetId: string | null;
          medusaPublishableKeyId: string | null;
          medusaRegionId: string | null;
          medusaSalesChannelId: string | null;
          medusaServiceZoneId: string | null;
          medusaShippingOptionId: string | null;
          medusaShippingProfileId: string | null;
          medusaStockLocationId: string | null;
          medusaStoreId: string | null;
        }
      | undefined,
  ): CommerceResources | null {
    if (
      !row?.medusaStoreId ||
      !row.medusaSalesChannelId ||
      !row.medusaRegionId ||
      !row.medusaShippingProfileId ||
      !row.medusaStockLocationId ||
      !row.medusaPublishableKeyId ||
      !row.medusaFulfillmentSetId ||
      !row.medusaServiceZoneId ||
      !row.medusaShippingOptionId
    ) {
      return null;
    }

    return {
      storeId: row.medusaStoreId,
      salesChannelId: row.medusaSalesChannelId,
      regionId: row.medusaRegionId,
      shippingProfileId: row.medusaShippingProfileId,
      stockLocationId: row.medusaStockLocationId,
      publishableKeyId: row.medusaPublishableKeyId,
      fulfillmentSetId: row.medusaFulfillmentSetId,
      serviceZoneId: row.medusaServiceZoneId,
      shippingOptionId: row.medusaShippingOptionId,
    };
  }

  async function seedCommerce(
    shop: DemoShopDefinition,
    resources: CommerceResources,
    userId: string,
    tenantId: string,
  ) {
    const metadata = {
      demo_seed: DEMO_SEED_MARKER,
      platform_tenant_id: tenantId,
      shop_handle: shop.tenant.handle,
    };

    // Nested categories: parents first, then children with parent_category_id.
    const categoryByHandle = new Map<string, { id: string; name: string }>();
    const roots = shop.categories.filter((category) => !category.parentHandle);
    const children = shop.categories.filter((category) => category.parentHandle);
    for (const category of [...roots, ...children]) {
      const parentId = category.parentHandle
        ? categoryByHandle.get(category.parentHandle)?.id
        : undefined;
      const result = await demoMedusa.post<{ product_category?: { id: string; name: string } }>(
        "/admin/product-categories",
        {
          handle: category.handle,
          is_active: true,
          is_internal: false,
          metadata,
          name: category.name,
          ...(parentId ? { parent_category_id: parentId } : {}),
        },
      );
      if (result?.product_category) {
        categoryByHandle.set(category.handle, result.product_category);
      }
    }
    const categories = [...categoryByHandle.values()];

    const collectionByHandle = new Map<string, { id: string; title: string }>();
    for (const collection of shop.collections) {
      const result = await demoMedusa.post<{ collection?: { id: string; title: string } }>(
        "/admin/collections",
        {
          handle: collection.handle,
          metadata,
          title: collection.title,
        },
      );
      if (result?.collection) {
        collectionByHandle.set(collection.handle, result.collection);
      }
    }
    const collections = [...collectionByHandle.values()];

    // Wipe prior demo media for this tenant so re-seed refreshes Seaweed + library.
    await demoMedia.resetTenant(tenantId);

    const products: ProductSeedResult[] = [];
    let mediaAssetsCreated = 0;
    let variantsStocked = 0;

    for (const [index, product] of shop.products.entries()) {
      const category =
        (product.categoryHandle ? categoryByHandle.get(product.categoryHandle) : undefined) ??
        categories[index % Math.max(categories.length, 1)];
      const collection =
        (product.collectionHandle ? collectionByHandle.get(product.collectionHandle) : undefined) ??
        collections[index % Math.max(collections.length, 1)];

      const curatedImages = demoProductImages(product.handle);
      const uploaded = await demoMedia.seedProductAssets({
        images: curatedImages,
        productHandle: product.handle,
        productTitle: product.title,
        tenantId,
        userId,
      });
      mediaAssetsCreated += uploaded.filter((asset) => asset.id).length;
      const imageUrls = uploaded.map((asset) => asset.publicUrl).filter(Boolean) as string[];
      // If Seaweed is unavailable, use the same curated sources rather than
      // replacing a real product with a random category image.
      if (!imageUrls.length) {
        imageUrls.push(...curatedImages.map((image) => image.url));
      }
      const thumbnail = imageUrls[0];
      if (!thumbnail) {
        throw new Error(`Demo product ${product.handle} has no usable product image`);
      }

      const result = await demoMedusa.post<{ product?: ProductSeedResult }>("/admin/products", {
        categories: category ? [{ id: category.id }] : [],
        collection_id: collection?.id,
        description: product.description,
        handle: product.handle,
        images: imageUrls.map((url) => ({ url })),
        metadata: {
          ...metadata,
          image_license: "Pexels License",
          image_sources: curatedImages.map((image) => image.sourceUrl),
          merchandising_family: product.imageCategory,
        },
        options: product.options.map((option) => ({
          title: option.title,
          values: [...option.values],
        })),
        sales_channels: [{ id: resources.salesChannelId }],
        shipping_profile_id: resources.shippingProfileId,
        status: "published",
        thumbnail,
        title: product.title,
        variants: product.variants.map((variant) => ({
          manage_inventory: true,
          options: variant.options,
          prices: [{ amount: variant.price, currency_code: "etb" }],
          // Prefix SKUs with tenant short id so re-seeds after soft-delete do not collide.
          sku: `${tenantId.slice(0, 8)}_${variant.sku}`.slice(0, 64),
          title:
            variant.title ?? `${product.title} / ${Object.values(variant.options).join(" / ")}`,
        })),
      });

      if (result?.product?.id) {
        // Create response may omit variants; re-fetch so orders can use variant ids.
        const detailed = await demoMedusa.get<{ product?: ProductSeedResult }>(
          `/admin/products/${encodeURIComponent(result.product.id)}?fields=id,title,variants.id,variants.title,variants.sku`,
        );
        const seededProduct = detailed?.product ?? result.product;
        products.push(seededProduct);
        variantsStocked += await seedProductStock(result.product.id, resources, product);
        if (uploaded.length) {
          await demoMedia.linkUsages({
            assets: uploaded,
            productId: result.product.id,
            tenantId,
            thumbnailUrl: thumbnail,
          });
        }
      }
    }

    // Customers must join this shop's tenant group or they won't appear in the dashboard list.
    const customerGroupId = await ensureTenantCustomerGroup(tenantId, shop.tenant.handle);
    const customerIds: string[] = [];
    let customersCreated = 0;

    for (const customer of shop.customers) {
      const customerId = await ensureDemoCustomer(customer, metadata, customerGroupId);
      if (!customerId) continue;
      customerIds.push(customerId);
      customersCreated += 1;
    }

    // Promotions (tenant-scoped via campaign_identifier prefix used by platform API)
    await demoCleanup.cleanTenantPromotions(tenantId, shop.tenant.handle);
    const promotionsCreated = await seedPromotions(tenantId, shop.tenant.handle, products);

    const orderSummary = await seedDemoOrders({
      customerIds,
      metadata,
      products,
      resources,
      shop,
    });

    return {
      skipped: false,
      categories: categories.length,
      collections: collections.length,
      products: products.length,
      variantsStocked,
      mediaAssets: mediaAssetsCreated,
      customers: customersCreated,
      promotions: promotionsCreated,
      orders: orderSummary.orders,
      drafts: orderSummary.drafts,
      cancelled: orderSummary.cancelled,
      completed: orderSummary.completed,
      createdBy: userId,
    };
  }

  async function seedDemoOrders(input: {
    customerIds: string[];
    metadata: Record<string, string>;
    products: ProductSeedResult[];
    resources: CommerceResources;
    shop: DemoShopDefinition;
  }) {
    const { customerIds, metadata, products, resources, shop } = input;
    const variants = products.flatMap((product) =>
      (product.variants ?? []).map((variant) => ({
        productTitle: product.title,
        variantId: variant.id,
      })),
    );

    let orders = 0;
    let drafts = 0;
    let cancelled = 0;
    let completed = 0;
    const orderCount = Math.min(
      24,
      Math.max(shop.customers.length * 3, 12),
      Math.max(variants.length, 1),
    );
    const orderIdsToBackdate: Array<{ id: string; createdAt: Date }> = [];

    for (let index = 0; index < orderCount; index += 1) {
      const primary = variants[index % variants.length];
      const secondary = variants[(index + 3) % variants.length];
      const customer = shop.customers[index % shop.customers.length];
      if (!primary || !customer) continue;

      const daysAgo = Math.min(34, Math.round((index / Math.max(orderCount - 1, 1)) * 34));
      const placedAt = addDays(new Date(), -daysAgo);
      placedAt.setUTCHours(9 + (index % 9), (index * 11) % 60, index % 60, 0);

      const items = [
        {
          quantity: (index % 3) + 1,
          variant_id: primary.variantId,
        },
      ];
      // Multi-line on most orders for a richer list/detail UI.
      if (secondary && secondary.variantId !== primary.variantId && index % 3 !== 0) {
        items.push({
          quantity: 1 + (index % 2),
          variant_id: secondary.variantId,
        });
      }

      const draft = await demoMedusa.post<{ draft_order?: { id: string }; order?: { id: string } }>(
        "/admin/draft-orders",
        {
          billing_address: demoAddress(customer),
          email: customer.email,
          ...(customerIds[index % customerIds.length]
            ? { customer_id: customerIds[index % customerIds.length] }
            : {}),
          items,
          metadata: {
            ...metadata,
            created_from: "demo_seed",
            checkout_type: "cod",
            payment_method: "cod",
            delivery_choice: index % 3 === 0 ? "pickup" : "delivery",
            customer_name: `${customer.firstName} ${customer.lastName}`.trim(),
            customer_phone: customer.phone,
            note: index % 5 === 0 ? "Please call before delivery — demo note" : "Demo cash order",
            demo_placed_at: placedAt.toISOString(),
          },
          region_id: resources.regionId,
          sales_channel_id: resources.salesChannelId,
          shipping_address: demoAddress(customer),
        },
      );

      const draftId = draft?.draft_order?.id ?? draft?.order?.id;
      if (!draftId) continue;

      // Leave every 5th as an open draft; convert the rest.
      if (index % 5 === 4) {
        await demoMedusa.backdateOrders([{ id: draftId, createdAt: placedAt }]);
        drafts += 1;
        orders += 1;
        continue;
      }

      const converted = await demoMedusa.post<{ order?: { id: string } }>(
        `/admin/draft-orders/${encodeURIComponent(draftId)}/convert-to-order`,
        {},
      );
      const orderId = converted?.order?.id;
      if (!orderId) continue;

      orderIdsToBackdate.push({ id: orderId, createdAt: placedAt });
      orders += 1;

      // Status mix: cancel some, complete some; rest stay open.
      if (index % 7 === 1) {
        const cancelledOk = await demoMedusa.post(
          `/admin/orders/${encodeURIComponent(orderId)}/cancel`,
          {},
        );
        if (cancelledOk) cancelled += 1;
      } else if (index % 4 === 0) {
        const completedOk = await demoMedusa.post(
          `/admin/orders/${encodeURIComponent(orderId)}/complete`,
          {},
        );
        if (completedOk) completed += 1;
      }
    }

    await demoMedusa.backdateOrders(orderIdsToBackdate);
    return { orders, drafts, cancelled, completed };
  }

  async function ensureTenantCustomerGroup(tenantId: string, handle: string) {
    const listed = await demoMedusa.get<{
      customer_groups?: Array<{ id: string; metadata?: { tenant_id?: string } | null }>;
    }>("/admin/customer-groups?limit=100");

    const existing = (listed?.customer_groups ?? []).find(
      (group) => group.metadata?.tenant_id === tenantId,
    );
    if (existing?.id) return existing.id;

    const created = await demoMedusa.post<{ customer_group?: { id: string } }>(
      "/admin/customer-groups",
      {
        metadata: { demo_seed: DEMO_SEED_MARKER, tenant_id: tenantId },
        name: `Shop ${handle}`,
      },
    );
    return created?.customer_group?.id ?? null;
  }

  async function ensureDemoCustomer(
    customer: DemoShopDefinition["customers"][number],
    metadata: Record<string, string>,
    customerGroupId: string | null,
  ) {
    let customerId: string | null = null;

    const created = await demoMedusa.post<{ customer?: { id: string } }>("/admin/customers", {
      email: customer.email,
      first_name: customer.firstName,
      last_name: customer.lastName,
      phone: customer.phone,
      metadata: { ...metadata, demo_customer: true },
    });

    if (created?.customer?.id) {
      customerId = created.customer.id;
    } else {
      // Email may already exist globally — look it up and reuse.
      const search = new URLSearchParams({ email: customer.email, limit: "1" });
      const found = await demoMedusa.get<{ customers?: Array<{ id: string }> }>(
        `/admin/customers?${search}`,
      );
      customerId = found?.customers?.[0]?.id ?? null;
    }

    if (!customerId) return null;

    await demoMedusa.post(`/admin/customers/${encodeURIComponent(customerId)}/addresses`, {
      address_1: customer.address,
      city: customer.area,
      country_code: "et",
      first_name: customer.firstName,
      is_default_shipping: true,
      last_name: customer.lastName,
      phone: customer.phone,
      province: "Addis Ababa",
    });

    if (customerGroupId) {
      await demoMedusa.post(
        `/admin/customer-groups/${encodeURIComponent(customerGroupId)}/customers`,
        {
          add: [customerId],
        },
      );
    }

    return customerId;
  }

  async function seedPromotions(tenantId: string, handle: string, products: ProductSeedResult[]) {
    const now = new Date();
    const startsAt = addDays(now, -21).toISOString();
    const endsAt = addDays(now, 60).toISOString();
    const campaignPrefix = `ecs_${tenantId}_`;
    const slug =
      handle
        .replace(/[^a-z0-9]/gi, "")
        .slice(0, 6)
        .toUpperCase() || "SHOP";
    const productIds = products
      .slice(0, 4)
      .map((product) => product.id)
      .filter(Boolean);

    type PromoSeed = {
      allocation?: "across" | "each";
      campaignName: string;
      code: string;
      isAutomatic: boolean;
      method: "fixed" | "percentage";
      productIds?: string[];
      targetType: "items" | "order" | "shipping_methods";
      type: "standard";
      value: number;
    };

    const promos: PromoSeed[] = [
      {
        code: `${slug}WELCOME10`,
        campaignName: "Welcome 10% off",
        type: "standard",
        method: "percentage",
        targetType: "order",
        value: 10,
        isAutomatic: false,
      },
      {
        code: `${slug}SAVE100`,
        campaignName: "Save 100 ETB",
        type: "standard",
        method: "fixed",
        targetType: "order",
        value: 100,
        isAutomatic: false,
      },
      {
        code: `${slug}FREESHIP`,
        campaignName: "Free local delivery",
        type: "standard",
        method: "percentage",
        targetType: "shipping_methods",
        value: 100,
        isAutomatic: true,
        allocation: "across",
      },
    ];

    if (productIds.length) {
      promos.push({
        code: `${slug}PICK15`,
        campaignName: "15% off featured picks",
        type: "standard",
        method: "percentage",
        targetType: "items",
        value: 15,
        isAutomatic: false,
        productIds,
        allocation: "each",
      });
    }

    let created = 0;
    for (const promo of promos) {
      const campaignIdentifier = `${campaignPrefix}${promo.code.replace(/[^A-Z0-9]+/g, "_")}`;
      const application_method: Record<string, unknown> = {
        target_type: promo.targetType,
        type: promo.method,
        value: promo.value,
      };
      if (promo.method === "fixed") {
        application_method.currency_code = "etb";
      }
      if (promo.allocation) {
        application_method.allocation = promo.allocation;
      }
      if (promo.productIds?.length) {
        application_method.target_rules = [
          {
            attribute: "items.product.id",
            operator: "in",
            values: promo.productIds,
          },
        ];
      }

      // Medusa rejects unknown fields like metadata on promotions.
      const result = await demoMedusa.post<{ promotion?: { id: string } }>("/admin/promotions", {
        application_method,
        campaign: {
          campaign_identifier: campaignIdentifier,
          ends_at: endsAt,
          name: promo.campaignName,
          starts_at: startsAt,
        },
        code: promo.code,
        is_automatic: promo.isAutomatic,
        is_tax_inclusive: false,
        status: "active",
        type: promo.type,
      });
      if (result?.promotion?.id) created += 1;
    }

    return created;
  }

  async function seedProductStock(
    productId: string,
    resources: CommerceResources,
    product: DemoProduct,
  ) {
    const detail = await demoMedusa.get<{
      product?: {
        variants?: Array<{
          id?: string;
          sku?: string | null;
          title?: string | null;
          inventory_items?: Array<{ inventory_item_id?: string }>;
        }>;
      };
    }>(
      `/admin/products/${encodeURIComponent(productId)}?fields=id,variants.id,variants.sku,variants.title,variants.inventory_items.inventory_item_id`,
    );

    let stocked = 0;
    const medusaVariants = detail?.product?.variants ?? [];
    for (const [index, variant] of medusaVariants.entries()) {
      const inventoryItemId = variant.inventory_items?.[0]?.inventory_item_id;
      if (!inventoryItemId) continue;

      const definition =
        product.variants.find((item) => {
          const skuTail = item.sku;
          return Boolean(variant.sku?.endsWith(skuTail) || variant.sku?.includes(skuTail));
        }) ?? product.variants[index];
      const stockedQuantity = definition?.stock ?? 25 + (index % 5) * 5;

      await demoMedusa
        .post(`/admin/inventory-items/${encodeURIComponent(inventoryItemId)}/location-levels`, {
          location_id: resources.stockLocationId,
          stocked_quantity: stockedQuantity,
        })
        .catch(() => null);

      // If level already exists, try update.
      await demoMedusa
        .post(
          `/admin/inventory-items/${encodeURIComponent(inventoryItemId)}/location-levels/${encodeURIComponent(resources.stockLocationId)}`,
          { stocked_quantity: stockedQuantity },
        )
        .catch(() => null);
      stocked += 1;
    }
    return stocked;
  }

  return { seedCommerce, toCommerceResources };
}
