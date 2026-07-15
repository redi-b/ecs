import type { PlatformAppOptions } from "../../app.js";
import { getPaginationValue } from "../shared.js";
import type { MerchantRouteApp, MerchantRouteHelpers } from "./context.js";

const DEFAULT_TYPES = ["product", "order", "customer"] as const;
const ALL_TYPES = new Set([
  "product",
  "order",
  "customer",
  "media",
  "category",
  "collection",
  "promotion",
]);

type SearchHit = {
  id: string;
  type: string;
  label: string;
  description: string | null;
  status: string | null;
};

/**
 * Aggregated search for the dashboard command center.
 * Fans out to existing list services with small limits (parallel).
 */
export function registerMerchantSearchRoutes(
  app: MerchantRouteApp,
  options: PlatformAppOptions,
  helpers: MerchantRouteHelpers,
) {
  app.get("/platform/merchant/search", async (context) => {
    const merchant = await helpers.getAuthorizedMerchantContext(context);
    if (!merchant.ok) return merchant.response;

    const q = context.req.query("q")?.trim() ?? "";
    if (q.length < 2) {
      return context.json({ results: [], query: q });
    }

    const perType = getPaginationValue(context.req.query("limit"), 6, 12);
    const typesParam = context.req.query("types")?.trim();
    const types = parseTypes(typesParam);

    const commerce = helpers.getResolvedCommerce(merchant.result.context);
    const salesChannelId = commerce.ok ? commerce.context.medusaSalesChannelId : null;
    const stockLocationId = merchant.result.context.medusaStockLocationId;
    const tenantId = merchant.result.context.tenantId;

    const tasks: Promise<SearchHit[]>[] = [];

    if (types.has("product") && options.listMerchantProducts && salesChannelId) {
      tasks.push(
        options
          .listMerchantProducts({
            limit: perType,
            offset: 0,
            q,
            salesChannelId,
            stockLocationId,
          })
          .then((result) => {
            if (!result.ok) return [] as SearchHit[];
            return result.products.map((product) => ({
              id: product.id,
              type: "product",
              label: product.title?.trim() || product.handle?.trim() || product.id,
              description: [product.handle, product.status].filter(Boolean).join(" · ") || null,
              status: product.status,
            }));
          })
          .catch(() => [] as SearchHit[]),
      );
    }

    if (types.has("order") && options.listMerchantOrders && salesChannelId) {
      tasks.push(
        options
          .listMerchantOrders({
            limit: perType,
            offset: 0,
            q,
            salesChannelId,
          })
          .then((result) => {
            if (!result.ok) return [] as SearchHit[];
            return result.orders.map((order) => {
              const display =
                order.displayId != null ? `#${order.displayId}` : order.id.slice(0, 8);
              const secondary = [order.email, order.paymentStatus, order.fulfillmentStatus]
                .filter(Boolean)
                .join(" · ");
              return {
                id: order.id,
                type: "order",
                label: display,
                description: secondary || null,
                status: order.status,
              };
            });
          })
          .catch(() => [] as SearchHit[]),
      );
    }

    if (types.has("customer") && options.listMerchantCustomers) {
      tasks.push(
        options
          .listMerchantCustomers({
            limit: perType,
            offset: 0,
            query: q,
            tenantId,
          })
          .then((result) => {
            if (!result.ok) return [] as SearchHit[];
            return result.customers.map((customer) => {
              const name = [customer.firstName, customer.lastName]
                .filter(Boolean)
                .join(" ")
                .trim();
              return {
                id: customer.id,
                type: "customer",
                label: name || customer.email,
                description: name ? customer.email : customer.phone || null,
                status: null,
              };
            });
          })
          .catch(() => [] as SearchHit[]),
      );
    }

    // Phase-2 types: media / taxonomy / promotions when requested and available.
    if (types.has("media") && options.listMediaAssets) {
      tasks.push(
        options
          .listMediaAssets({
            limit: perType,
            offset: 0,
            query: q,
            tenantId,
          })
          .then((result) => {
            if (!result.ok) return [] as SearchHit[];
            return result.assets.map((asset) => ({
              id: asset.id,
              type: "media",
              label: asset.displayName?.trim() || asset.filename?.trim() || asset.id,
              description: asset.mimeType || null,
              status: asset.status || null,
            }));
          })
          .catch(() => [] as SearchHit[]),
      );
    }

    if (types.has("category") && options.listMerchantProductCategories) {
      tasks.push(
        options
          .listMerchantProductCategories({
            limit: perType,
            offset: 0,
            q,
            tenantId,
          })
          .then((result) => {
            if (!result.ok) return [] as SearchHit[];
            return result.categories.map((category) => ({
              id: category.id,
              type: "category",
              label: category.name?.trim() || category.handle?.trim() || category.id,
              description: category.handle || null,
              status: category.isActive === false ? "inactive" : "active",
            }));
          })
          .catch(() => [] as SearchHit[]),
      );
    }

    if (types.has("collection") && options.listMerchantProductCollections) {
      tasks.push(
        options
          .listMerchantProductCollections({
            limit: perType,
            offset: 0,
            q,
            tenantId,
          })
          .then((result) => {
            if (!result.ok) return [] as SearchHit[];
            return result.collections.map((collection) => ({
              id: collection.id,
              type: "collection",
              label: collection.title?.trim() || collection.handle?.trim() || collection.id,
              description: collection.handle || null,
              status: null,
            }));
          })
          .catch(() => [] as SearchHit[]),
      );
    }

    if (types.has("promotion") && options.listMerchantPromotions) {
      tasks.push(
        options
          .listMerchantPromotions({
            limit: perType,
            offset: 0,
            query: q,
            tenantId,
          })
          .then((result) => {
            if (!result.ok) return [] as SearchHit[];
            return result.promotions.map((promo) => ({
              id: promo.id,
              type: "promotion",
              label: promo.code?.trim() || promo.id,
              description:
                [promo.method, promo.status].filter(Boolean).join(" · ") || null,
              status: promo.status ?? null,
            }));
          })
          .catch(() => [] as SearchHit[]),
      );
    }

    const batches = await Promise.all(tasks);
    const results = batches.flat();

    return context.json({
      results,
      query: q,
    });
  });
}

function parseTypes(raw: string | undefined): Set<string> {
  if (!raw) {
    return new Set(DEFAULT_TYPES);
  }
  const parts = raw
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter((part) => ALL_TYPES.has(part));
  return parts.length > 0 ? new Set(parts) : new Set(DEFAULT_TYPES);
}
