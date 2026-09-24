import { z } from "zod";
import { getMediaLimitsConfig } from "../../adapters/storage/env.js";
import type { PlatformAppOptions } from "../../app.js";
import { getProductMediaReferences } from "../../modules/media/product-references.js";

type MerchantMediaRouteDependencies = Pick<
  PlatformAppOptions,
  | "completeMediaUpload"
  | "createMediaUpload"
  | "deleteMediaAsset"
  | "getMerchantProduct"
  | "listMediaAssets"
  | "syncProductMedia"
  | "updateMediaMetadata"
>;

import type { MerchantRouteApp, MerchantRouteHelpers } from "./context.js";

const createUploadSchema = z.object({
  accessMode: z.enum(["public", "private"]).default("public"),
  byteSize: z.number().int().positive(),
  context: z.enum(["product", "editor", "settings", "media-library"]),
  filename: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(160),
});

const completeUploadSchema = z.object({
  altText: z.string().max(500).nullish(),
  height: z.number().int().positive().nullish(),
  width: z.number().int().positive().nullish(),
});

const updateMetadataSchema = z
  .object({
    altText: z.string().max(500).nullish(),
    displayName: z.string().trim().min(1).max(255).optional(),
  })
  .refine((value) => value.altText !== undefined || value.displayName !== undefined);
const syncProductMediaSchema = z.object({
  imageUrls: z.array(z.string().url()).max(100),
  thumbnail: z.string().url().nullable(),
  variantImageUrls: z.array(z.string().url()).max(100).optional(),
});

export function registerMerchantMediaRoutes(
  app: MerchantRouteApp,
  options: MerchantMediaRouteDependencies,
  helpers: MerchantRouteHelpers,
) {
  app.get("/platform/merchant/media/config", async (context) => {
    return context.json(getMediaLimitsConfig());
  });
  app.get("/api/v1/media/config", async (context) => {
    return context.json(getMediaLimitsConfig());
  });
  app.get("/media/config", async (context) => {
    return context.json(getMediaLimitsConfig());
  });

  app.post("/platform/merchant/media/uploads", async (context) => {
    const merchant = await helpers.getAuthorizedMerchantContext(context, { media: ["manage"] });
    if (!merchant.ok) return merchant.response;
    if (!options.createMediaUpload) {
      return context.json({ error: "media_storage_unavailable" }, 503);
    }

    const body = await context.req.json().catch(() => null);
    const parsed = createUploadSchema.safeParse(body);
    if (!parsed.success) return context.json({ error: "invalid_media_asset" }, 400);

    const result = await options.createMediaUpload({
      ...parsed.data,
      tenantId: merchant.result.context.tenantId,
      userId: merchant.session.user.id,
    });
    return result.ok
      ? context.json(result, 201)
      : context.json({ error: result.error }, result.status);
  });

  app.post("/platform/merchant/media/uploads/:assetId/complete", async (context) => {
    const merchant = await helpers.getAuthorizedMerchantContext(context, { media: ["manage"] });
    if (!merchant.ok) return merchant.response;
    if (!options.completeMediaUpload) {
      return context.json({ error: "media_storage_unavailable" }, 503);
    }

    const body = await context.req.json().catch(() => null);
    const parsed = completeUploadSchema.safeParse(body);
    if (!parsed.success) return context.json({ error: "invalid_media_asset" }, 400);

    const result = await options.completeMediaUpload({
      ...parsed.data,
      assetId: context.req.param("assetId"),
      tenantId: merchant.result.context.tenantId,
    });
    return result.ok ? context.json(result) : context.json({ error: result.error }, result.status);
  });

  app.get("/platform/merchant/media", async (context) => {
    const merchant = await helpers.getAuthorizedMerchantContext(context, { media: ["read"] });
    if (!merchant.ok) return merchant.response;
    if (!options.listMediaAssets) {
      return context.json({ error: "media_storage_unavailable" }, 503);
    }

    const limit = parseBoundedInteger(context.req.query("limit"), 20, 1, 100);
    const offset = parseBoundedInteger(context.req.query("offset"), 0, 0, 100_000);
    const orientation = parseMediaOrientation(context.req.query("orientation"));
    const size = parseMediaSize(context.req.query("size"));
    const sort = parseMediaSort(context.req.query("sort"));
    const publicOnly = context.req.query("publicOnly");
    if (publicOnly !== undefined && publicOnly !== "true" && publicOnly !== "false")
      return context.json({ error: "invalid_media_filter" }, 400);
    if (!orientation.ok || !size.ok || !sort.ok) {
      return context.json({ error: "invalid_media_filter" }, 400);
    }
    const result = await options.listMediaAssets({
      ...(publicOnly === "true" ? { publicOnly: true } : {}),
      limit,
      mimeType: context.req.query("mimeType")?.trim() || undefined,
      offset,
      ...(orientation.value ? { orientation: orientation.value } : {}),
      query: context.req.query("q")?.trim() || undefined,
      ...(size.value ? { size: size.value } : {}),
      ...(sort.value ? { sort: sort.value } : {}),
      tenantId: merchant.result.context.tenantId,
    });
    return context.json(result);
  });

  app.post("/platform/merchant/media/:assetId", async (context) => {
    const merchant = await helpers.getAuthorizedMerchantContext(context, { media: ["manage"] });
    if (!merchant.ok) return merchant.response;
    if (!options.updateMediaMetadata) {
      return context.json({ error: "media_storage_unavailable" }, 503);
    }

    const body = await context.req.json().catch(() => null);
    const parsed = updateMetadataSchema.safeParse(body);
    if (!parsed.success) return context.json({ error: "invalid_media_asset" }, 400);

    const result = await options.updateMediaMetadata({
      ...parsed.data,
      assetId: context.req.param("assetId"),
      tenantId: merchant.result.context.tenantId,
    });
    return result.ok ? context.json(result) : context.json({ error: result.error }, result.status);
  });

  app.delete("/platform/merchant/media/:assetId", async (context) => {
    const merchant = await helpers.getAuthorizedMerchantContext(context, { media: ["manage"] });
    if (!merchant.ok) return merchant.response;
    if (!options.deleteMediaAsset) {
      return context.json({ error: "media_storage_unavailable" }, 503);
    }

    const result = await options.deleteMediaAsset({
      assetId: context.req.param("assetId"),
      tenantId: merchant.result.context.tenantId,
    });
    return result.ok ? context.json(result) : context.json({ error: result.error }, result.status);
  });

  app.post("/platform/merchant/media/products/:productId", async (context) => {
    const merchant = await helpers.getAuthorizedMerchantContext(context, {
      media: ["manage"],
      products: ["update"],
    });
    if (!merchant.ok) return merchant.response;
    if (!options.syncProductMedia || !options.getMerchantProduct) {
      return context.json({ error: "media_storage_unavailable" }, 503);
    }
    const parsed = syncProductMediaSchema.safeParse(await context.req.json().catch(() => null));
    if (!parsed.success) return context.json({ error: "invalid_media_asset" }, 400);
    const commerce = helpers.getResolvedCommerce(merchant.result.context);
    if (!commerce.ok) return context.json({ error: commerce.error }, commerce.status);
    const product = await options.getMerchantProduct({
      productId: context.req.param("productId"),
      salesChannelId: commerce.context.medusaSalesChannelId,
    });
    if (!product.ok) return context.json({ error: product.error }, product.status);
    // Reconcile the saved product, not arbitrary references supplied by a caller.
    const result = await options.syncProductMedia({
      ...getProductMediaReferences(product.product),
      productId: product.product.id,
      tenantId: merchant.result.context.tenantId,
    });
    return context.json(result);
  });
}

function parseBoundedInteger(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

function parseEnumFilter<const T extends readonly string[]>(value: string | undefined, values: T) {
  if (!value?.trim() || value === "all") return { ok: true as const, value: undefined };
  return values.includes(value as T[number])
    ? { ok: true as const, value: value as T[number] }
    : { ok: false as const, value: undefined };
}

function parseMediaOrientation(value: string | undefined) {
  return parseEnumFilter(value, ["landscape", "portrait", "square"] as const);
}

function parseMediaSize(value: string | undefined) {
  return parseEnumFilter(value, ["small", "medium", "large"] as const);
}

function parseMediaSort(value: string | undefined) {
  return parseEnumFilter(value, [
    "newest",
    "oldest",
    "name_asc",
    "name_desc",
    "largest",
    "smallest",
  ] as const);
}
