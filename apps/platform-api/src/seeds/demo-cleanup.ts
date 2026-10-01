import type { createPlatformDb } from "@ecs/db";
import { tenants, users } from "@ecs/db";
import { inArray, or } from "drizzle-orm";
import type { createDemoMedusaClient } from "./demo-medusa-client.js";
import { cleanDemoPlatformData } from "./demo-platform-cleanup.js";
import {
  DEMO_OPERATIONS,
  DEMO_SEED_MARKER,
  demoShops,
  LEGACY_DEMO_EMAILS,
  LEGACY_DEMO_HANDLES,
} from "./demo-shops.js";

type DemoCleanupOptions = {
  db: ReturnType<typeof createPlatformDb>["db"];
  medusa: ReturnType<typeof createDemoMedusaClient>;
};

export function createDemoCleanup(options: DemoCleanupOptions) {
  async function cleanAllDemoData() {
    const handles = [...demoShops.map((shop) => shop.tenant.handle), ...LEGACY_DEMO_HANDLES];
    const emails = [...demoShops.map((shop) => shop.user.email), ...LEGACY_DEMO_EMAILS];
    const tenantIds = demoShops.map((shop) => shop.ids.tenant);

    const existingTenants = await options.db
      .select({
        id: tenants.id,
        handle: tenants.handle,
        medusaSalesChannelId: tenants.medusaSalesChannelId,
        organizationId: tenants.organizationId,
      })
      .from(tenants)
      .where(or(inArray(tenants.handle, handles), inArray(tenants.id, tenantIds)));

    const idsToRemove = [...new Set([...tenantIds, ...existingTenants.map((row) => row.id)])];
    const organizationIdsToRemove = existingTenants.flatMap((row) =>
      row.organizationId ? [row.organizationId] : [],
    );

    let commerce = {
      categories: 0,
      collections: 0,
      customers: 0,
      orders: 0,
      products: 0,
      promotions: 0,
    };

    for (const shop of demoShops) {
      const live =
        existingTenants.find((row) => row.handle === shop.tenant.handle) ??
        existingTenants.find((row) => row.id === shop.ids.tenant);
      const tenantId = live?.id ?? shop.ids.tenant;
      const channelId = live?.medusaSalesChannelId ?? null;
      // Also pass legacy handles so catalog rows tagged with old shop_handle are removed.
      const removed = await cleanShopCommerce(shop.tenant.handle, tenantId, channelId);
      commerce = {
        categories: commerce.categories + removed.categories,
        collections: commerce.collections + removed.collections,
        customers: commerce.customers + removed.customers,
        orders: commerce.orders + removed.orders,
        products: commerce.products + removed.products,
        promotions: commerce.promotions + removed.promotions,
      };
    }

    // Legacy handle commerce (e.g. addis-tech) when stable tenant row already gone.
    for (const legacyHandle of LEGACY_DEMO_HANDLES) {
      if (demoShops.some((shop) => shop.tenant.handle === legacyHandle)) continue;
      const live = existingTenants.find((row) => row.handle === legacyHandle);
      if (!live) continue;
      const removed = await cleanShopCommerce(legacyHandle, live.id, live.medusaSalesChannelId);
      commerce = {
        categories: commerce.categories + removed.categories,
        collections: commerce.collections + removed.collections,
        customers: commerce.customers + removed.customers,
        orders: commerce.orders + removed.orders,
        products: commerce.products + removed.products,
        promotions: commerce.promotions + removed.promotions,
      };
    }

    const existingUsers = await options.db
      .select({ id: users.id })
      .from(users)
      .where(
        or(
          inArray(users.email, emails),
          inArray(
            users.id,
            demoShops.map((shop) => shop.ids.user),
          ),
        ),
      );
    const userIds = existingUsers.map((row) => row.id);
    await cleanDemoPlatformData(options.db, {
      tenantIds: idsToRemove,
      organizationIds: organizationIdsToRemove,
      userIds: [...new Set([...userIds, DEMO_OPERATIONS.operator.id, DEMO_OPERATIONS.approver.id])],
    });

    return {
      commerce,
      tenantsRemoved: idsToRemove.length,
      usersRemoved: userIds.length,
    };
  }

  function isDemoMetadata(
    metadata: Record<string, unknown> | null | undefined,
    tenantId: string,
    handle: string,
  ) {
    if (!metadata) return false;
    // Always scope to this tenant/handle so multi-shop re-seeds do not cross-delete.
    if (metadata.platform_tenant_id === tenantId) return true;
    if (metadata.shop_handle === handle) return true;
    // Renamed tech shop: old handle still tags catalog on the same stable tenant id path above;
    // when cleaning by legacy handle, match products tagged with that handle.
    if (
      (LEGACY_DEMO_HANDLES as readonly string[]).includes(handle) &&
      metadata.shop_handle === handle
    ) {
      return true;
    }
    if (
      handle === "addistech" &&
      metadata.shop_handle === "addis-tech" &&
      (metadata.platform_tenant_id === tenantId ||
        metadata.demo_seed === DEMO_SEED_MARKER ||
        metadata.demo_seed === "ecs-demo-v2")
    ) {
      return true;
    }
    return false;
  }

  async function cleanShopCommerce(
    handle: string,
    tenantId: string,
    salesChannelId?: string | null,
  ) {
    const summary = {
      categories: 0,
      collections: 0,
      customers: 0,
      orders: 0,
      products: 0,
      promotions: 0,
    };

    const demoEmails = new Set(demoShops.flatMap((shop) => shop.customers.map((c) => c.email)));

    // Orders first so product deletes are less likely to fail on line-item refs.
    // Cancel + archive removes them from the default merchant list on re-seed.
    summary.orders = await cleanDemoOrders({
      demoEmails,
      handle,
      tenantId,
      ...(salesChannelId !== undefined ? { salesChannelId } : {}),
    });
    await cleanDemoDraftOrders({
      demoEmails,
      handle,
      tenantId,
      ...(salesChannelId !== undefined ? { salesChannelId } : {}),
    });

    const shop = demoShops.find((item) => item.tenant.handle === handle);
    const shopProductHandles = new Set(shop?.products.map((item) => item.handle) ?? []);

    // Paginate products — a single page misses leftovers after prior partial seeds.
    for await (const product of paginateMedusaList<{
      handle?: string | null;
      id: string;
      metadata?: Record<string, unknown>;
    }>("/admin/products", "products", "id,handle,metadata")) {
      const byMeta = isDemoMetadata(product.metadata, tenantId, handle);
      const byHandle = Boolean(product.handle && shopProductHandles.has(product.handle));
      if (byMeta || byHandle) {
        await options.medusa.delete(`/admin/products/${encodeURIComponent(product.id)}`);
        summary.products += 1;
      }
    }

    const shopCollectionHandles = new Set(shop?.collections.map((item) => item.handle) ?? []);
    for await (const collection of paginateMedusaList<{
      handle?: string | null;
      id: string;
      metadata?: Record<string, unknown>;
    }>("/admin/collections", "collections", "id,handle,metadata")) {
      if (
        isDemoMetadata(collection.metadata, tenantId, handle) ||
        (collection.handle && shopCollectionHandles.has(collection.handle))
      ) {
        await options.medusa.delete(`/admin/collections/${encodeURIComponent(collection.id)}`);
        summary.collections += 1;
      }
    }

    const shopCategoryHandles = new Set(shop?.categories.map((item) => item.handle) ?? []);
    // Collect matching categories, then delete children before parents (Medusa FK).
    const categoriesToDelete: Array<{ id: string; handle?: string | null }> = [];
    for await (const category of paginateMedusaList<{
      handle?: string | null;
      id: string;
      metadata?: Record<string, unknown>;
    }>("/admin/product-categories", "product_categories", "id,handle,metadata")) {
      if (
        isDemoMetadata(category.metadata, tenantId, handle) ||
        (category.handle && shopCategoryHandles.has(category.handle))
      ) {
        categoriesToDelete.push(category);
      }
    }
    const parentHandles = new Set(
      (shop?.categories ?? []).filter((item) => !item.parentHandle).map((item) => item.handle),
    );
    categoriesToDelete.sort((a, b) => {
      const aParent = a.handle && parentHandles.has(a.handle) ? 1 : 0;
      const bParent = b.handle && parentHandles.has(b.handle) ? 1 : 0;
      return aParent - bParent;
    });
    for (const category of categoriesToDelete) {
      await options.medusa.delete(`/admin/product-categories/${encodeURIComponent(category.id)}`);
      summary.categories += 1;
    }

    // Demo customers (by known emails).
    for (const customer of shop?.customers ?? []) {
      const found = await options.medusa.get<{
        customers?: Array<{ id: string }>;
      }>(`/admin/customers?limit=5&email=${encodeURIComponent(customer.email)}`);
      for (const row of found?.customers ?? []) {
        await options.medusa.delete(`/admin/customers/${encodeURIComponent(row.id)}`);
        summary.customers += 1;
      }
    }

    summary.promotions = await cleanTenantPromotions(tenantId, handle);
    return summary;
  }

  /**
   * Remove demo orders from the merchant list on re-seed.
   * Medusa has no hard delete for orders — cancel + archive is the supported cleanup.
   */
  async function cleanDemoOrders(input: {
    demoEmails: Set<string>;
    handle: string;
    salesChannelId?: string | null;
    tenantId: string;
  }) {
    let removed = 0;
    const pageSize = 100;
    let offset = 0;

    for (let page = 0; page < 20; page += 1) {
      const orderQuery = new URLSearchParams({
        fields: "id,metadata,sales_channel_id,email,status",
        limit: String(pageSize),
        offset: String(offset),
        order: "-created_at",
      });
      // Medusa list expects array form for sales channel filter.
      if (input.salesChannelId) {
        orderQuery.append("sales_channel_id[]", input.salesChannelId);
      }

      const listed = await options.medusa.get<{
        count?: number;
        orders?: Array<{
          email?: string | null;
          id: string;
          metadata?: Record<string, unknown> | null;
          sales_channel_id?: string | null;
          status?: string | null;
        }>;
      }>(`/admin/orders?${orderQuery}`);

      const batch = listed?.orders ?? [];
      if (batch.length === 0) break;

      for (const order of batch) {
        const channelMatch =
          !input.salesChannelId || order.sales_channel_id === input.salesChannelId;
        const demoOrder =
          isDemoMetadata(order.metadata ?? undefined, input.tenantId, input.handle) ||
          (channelMatch && order.email && input.demoEmails.has(order.email));
        if (!demoOrder || !channelMatch) continue;

        const status = (order.status ?? "").toLowerCase();
        if (!status.includes("cancel")) {
          await options.medusa
            .post(`/admin/orders/${encodeURIComponent(order.id)}/cancel`, {})
            .catch(() => null);
        }
        await options.medusa
          .post(`/admin/orders/${encodeURIComponent(order.id)}/archive`, {})
          .catch(() => null);
        removed += 1;
      }

      offset += batch.length;
      if (batch.length < pageSize) break;
      if (typeof listed?.count === "number" && offset >= listed.count) break;
    }

    return removed;
  }

  async function cleanDemoDraftOrders(input: {
    demoEmails: Set<string>;
    handle: string;
    salesChannelId?: string | null;
    tenantId: string;
  }) {
    for await (const draft of paginateMedusaList<{
      email?: string | null;
      id: string;
      metadata?: Record<string, unknown> | null;
      sales_channel_id?: string | null;
    }>("/admin/draft-orders", "draft_orders", "id,metadata,sales_channel_id,email")) {
      const channelMatch = !input.salesChannelId || draft.sales_channel_id === input.salesChannelId;
      const isDemo =
        isDemoMetadata(draft.metadata ?? undefined, input.tenantId, input.handle) ||
        (channelMatch && draft.email && input.demoEmails.has(draft.email));
      if (!isDemo || !channelMatch) continue;
      await options.medusa.delete(`/admin/draft-orders/${encodeURIComponent(draft.id)}`);
    }
  }

  /** Walk Medusa admin list endpoints until exhausted (or a safety page cap). */
  async function* paginateMedusaList<T extends { id: string }>(
    path: string,
    key: string,
    fields: string,
    pageSize = 100,
  ): AsyncGenerator<T> {
    let offset = 0;
    for (let page = 0; page < 30; page += 1) {
      const query = new URLSearchParams({
        fields,
        limit: String(pageSize),
        offset: String(offset),
      });
      const separator = path.includes("?") ? "&" : "?";
      const listed = await options.medusa.get<Record<string, unknown>>(
        `${path}${separator}${query.toString()}`,
      );
      const batch = Array.isArray(listed?.[key]) ? (listed[key] as T[]) : [];
      if (batch.length === 0) return;
      for (const item of batch) {
        yield item;
      }
      offset += batch.length;
      if (batch.length < pageSize) return;
    }
  }

  async function cleanTenantPromotions(tenantId: string, handle: string) {
    let removed = 0;
    const campaignPrefix = `ecs_${tenantId}_`;
    const slug =
      handle
        .replace(/[^a-z0-9]/gi, "")
        .slice(0, 6)
        .toUpperCase() || "SHOP";
    const promotions = await options.medusa.get<{
      promotions?: Array<{
        id: string;
        code?: string | null;
        campaign?: { campaign_identifier?: string | null } | null;
        campaign_id?: string | null;
      }>;
    }>("/admin/promotions?limit=100&fields=id,code,+campaign,+campaign.campaign_identifier");

    for (const promotion of promotions?.promotions ?? []) {
      const identifier = promotion.campaign?.campaign_identifier ?? "";
      const code = (promotion.code ?? "").toUpperCase();
      const isDemo =
        identifier.startsWith(campaignPrefix) ||
        code.startsWith(slug) ||
        code.startsWith(handle.slice(0, 4).toUpperCase());
      if (isDemo) {
        await options.medusa.delete(`/admin/promotions/${encodeURIComponent(promotion.id)}`);
        removed += 1;
      }
    }

    // Deleting a promotion can leave the campaign row; identifiers must be free for re-seed.
    const campaigns = await options.medusa.get<{
      campaigns?: Array<{ campaign_identifier?: string | null; id: string }>;
    }>("/admin/campaigns?limit=100");

    for (const campaign of campaigns?.campaigns ?? []) {
      const identifier = campaign.campaign_identifier ?? "";
      if (identifier.startsWith(campaignPrefix) || identifier.includes(tenantId)) {
        await options.medusa.delete(`/admin/campaigns/${encodeURIComponent(campaign.id)}`);
      }
    }

    return removed;
  }

  async function cleanTenantPriceLists(handle: string) {
    const slug =
      handle
        .replace(/[^a-z0-9]/gi, "")
        .slice(0, 6)
        .toUpperCase() || "SHOP";

    const listed = await options.medusa
      .get<{ price_lists?: Array<{ id: string; title?: string | null }> }>(
        "/admin/price-lists?limit=50&fields=id,title",
      )
      .catch(() => null);

    let removed = 0;
    for (const pl of listed?.price_lists ?? []) {
      const title = (pl.title ?? "").toUpperCase();
      if (title.includes(slug) || title.includes("SEASONAL SALE")) {
        await options.medusa
          .delete(`/admin/price-lists/${encodeURIComponent(pl.id)}`)
          .catch(() => null);
        removed += 1;
      }
    }
    return removed;
  }

  return { cleanAllDemoData, cleanShopCommerce, cleanTenantPriceLists, cleanTenantPromotions };
}
