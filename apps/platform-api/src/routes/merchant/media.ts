import { z } from "zod";

import type { PlatformAppOptions } from "../../app.js";
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
});

export function registerMerchantMediaRoutes(
  app: MerchantRouteApp,
  options: PlatformAppOptions,
  helpers: MerchantRouteHelpers,
) {
  app.post("/platform/merchant/media/uploads", async (context) => {
    const merchant = await helpers.getAuthorizedMerchantContext(context);
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
    const merchant = await helpers.getAuthorizedMerchantContext(context);
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
    const merchant = await helpers.getAuthorizedMerchantContext(context);
    if (!merchant.ok) return merchant.response;
    if (!options.listMediaAssets) {
      return context.json({ error: "media_storage_unavailable" }, 503);
    }

    const limit = parseBoundedInteger(context.req.query("limit"), 20, 1, 100);
    const offset = parseBoundedInteger(context.req.query("offset"), 0, 0, 100_000);
    const result = await options.listMediaAssets({
      limit,
      mimeType: context.req.query("mimeType")?.trim() || undefined,
      offset,
      query: context.req.query("q")?.trim() || undefined,
      tenantId: merchant.result.context.tenantId,
    });
    return context.json(result);
  });

  app.post("/platform/merchant/media/:assetId", async (context) => {
    const merchant = await helpers.getAuthorizedMerchantContext(context);
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
    const merchant = await helpers.getAuthorizedMerchantContext(context);
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
    const merchant = await helpers.getAuthorizedMerchantContext(context);
    if (!merchant.ok) return merchant.response;
    if (!options.syncProductMedia) {
      return context.json({ error: "media_storage_unavailable" }, 503);
    }
    const parsed = syncProductMediaSchema.safeParse(await context.req.json().catch(() => null));
    if (!parsed.success) return context.json({ error: "invalid_media_asset" }, 400);
    const result = await options.syncProductMedia({
      ...parsed.data,
      productId: context.req.param("productId"),
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
