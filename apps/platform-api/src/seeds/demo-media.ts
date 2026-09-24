import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { type createPlatformDb, mediaAssets, mediaUsages } from "@ecs/db";
import { eq } from "drizzle-orm";
import { generateObjectKey } from "../modules/media/variants.js";
import type { DemoProductImage } from "./demo/types.js";
import { ensureS3Bucket } from "./seed-media-storage.js";

type DemoMediaSeederOptions = {
  db: ReturnType<typeof createPlatformDb>["db"];
  env: NodeJS.ProcessEnv;
};

type SeededMediaAsset = {
  id: string | null;
  publicUrl: string | null;
};

export function createDemoMediaSeeder(options: DemoMediaSeederOptions) {
  function resolveApiEndpoint(): string | undefined {
    const internal = options.env.MEDIA_S3_INTERNAL_ENDPOINT?.trim();
    if (internal) return internal.replace(/\/$/, "");
    if (options.env.MEDIA_S3_USE_DOCKER_INTERNAL === "true") {
      return "http://seaweedfs:8333";
    }

    const publicEndpoint = options.env.MEDIA_S3_ENDPOINT?.trim();
    if (
      publicEndpoint &&
      (publicEndpoint.includes("media.") || publicEndpoint.startsWith("https://")) &&
      (options.env.HOSTNAME === "platform-api" ||
        options.env.SERVICE_NAME === "platform-api" ||
        Boolean(options.env.PLATFORM_DATABASE_URL?.includes("@postgres")))
    ) {
      return "http://seaweedfs:8333";
    }
    return publicEndpoint?.replace(/\/$/, "") || undefined;
  }

  function getConfig() {
    const bucket = options.env.MEDIA_S3_BUCKET?.trim();
    const accessKeyId = options.env.MEDIA_S3_ACCESS_KEY_ID?.trim();
    const secretAccessKey = options.env.MEDIA_S3_SECRET_ACCESS_KEY?.trim();
    if (!bucket || !accessKeyId || !secretAccessKey) return null;

    const endpoint = resolveApiEndpoint();
    const forcePathStyleEnv = options.env.MEDIA_S3_FORCE_PATH_STYLE?.trim().toLowerCase();
    return {
      accessKeyId,
      bucket,
      endpoint,
      forcePathStyle:
        forcePathStyleEnv === "true" ||
        forcePathStyleEnv === "1" ||
        (forcePathStyleEnv !== "false" && Boolean(endpoint)),
      publicBaseUrl: options.env.MEDIA_S3_PUBLIC_BASE_URL?.trim() || undefined,
      region: options.env.MEDIA_S3_REGION?.trim() || "us-east-1",
      secretAccessKey,
    };
  }

  function createClient(config: NonNullable<ReturnType<typeof getConfig>>) {
    return new S3Client({
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      ...(config.endpoint ? { endpoint: config.endpoint } : {}),
      forcePathStyle: config.forcePathStyle,
      region: config.region,
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
  }

  function formatError(error: unknown) {
    if (!error || typeof error !== "object") return String(error);
    const value = error as {
      message?: string;
      name?: string;
      Code?: string;
      $metadata?: { httpStatusCode?: number };
    };
    return (
      [
        value.name,
        value.Code,
        value.$metadata?.httpStatusCode != null ? `http=${value.$metadata.httpStatusCode}` : null,
        value.message,
      ]
        .filter(Boolean)
        .join(" ") || String(error)
    );
  }

  async function fetchImage(url: string) {
    try {
      const response = await fetch(url, {
        redirect: "follow",
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) return null;
      const bytes = Buffer.from(await response.arrayBuffer());
      if (!bytes.byteLength) return null;
      return {
        bytes,
        mimeType: response.headers.get("content-type")?.split(";")[0]?.trim() || "image/jpeg",
      };
    } catch {
      return null;
    }
  }

  async function seedProductAssets(input: {
    images: readonly DemoProductImage[];
    productHandle: string;
    productTitle: string;
    tenantId: string;
    userId: string;
  }): Promise<SeededMediaAsset[]> {
    const config = getConfig();
    if (!config) {
      console.warn(
        "[seed:demo] MEDIA_S3_* not configured — product images will use remote URLs only.",
      );
      return [];
    }

    const client = createClient(config);
    const bucket = await ensureS3Bucket(client, config.bucket);
    if (!bucket.ok) {
      console.warn(
        `[seed:demo] Media bucket ${config.bucket} is unavailable (${formatError(bucket.error)}); using curated CDN URLs.`,
      );
      return input.images.map((image) => ({ id: null, publicUrl: image.url }));
    }
    if (bucket.created) console.info(`[seed:demo] Created media bucket ${config.bucket}.`);

    const assets: SeededMediaAsset[] = [];
    for (const [index, image] of input.images.entries()) {
      const fetched = await fetchImage(image.url);
      if (!fetched) {
        console.warn(`[seed:demo] Could not copy curated image ${image.sourceUrl}; using CDN URL.`);
        assets.push({ id: null, publicUrl: image.url });
        continue;
      }

      const ext = fetched.mimeType.includes("png") ? "png" : "jpg";
      const filename = `${input.productHandle}-${index + 1}.${ext}`;
      const assetId = crypto.randomUUID();
      const objectKey = generateObjectKey({
        accessMode: "public",
        assetId,
        filename,
        tenantId: input.tenantId,
      });
      const publicUrl = config.publicBaseUrl
        ? `${config.publicBaseUrl.replace(/\/$/, "")}/${objectKey}`
        : null;

      try {
        await client.send(
          new PutObjectCommand({
            Body: fetched.bytes,
            Bucket: config.bucket,
            ContentLength: fetched.bytes.byteLength,
            ContentType: fetched.mimeType,
            Key: objectKey,
          }),
        );
      } catch (error) {
        console.warn(
          `[seed:demo] Media upload failed for ${filename} → ${config.endpoint ?? "default"}/${config.bucket}/${objectKey}: ${formatError(error)}`,
        );
        if (index === 0) {
          console.warn(
            "[seed:demo] Hint: set MEDIA_S3_INTERNAL_ENDPOINT=http://seaweedfs:8333 in Docker while keeping MEDIA_S3_PUBLIC_BASE_URL for browsers.",
          );
        }
        assets.push({ id: null, publicUrl: image.url });
        continue;
      }

      await options.db.insert(mediaAssets).values({
        accessMode: "public",
        altText: `${input.productTitle} photo ${index + 1}`,
        bucket: config.bucket,
        byteSize: fetched.bytes.byteLength,
        createdByUserId: input.userId,
        displayName: filename,
        filename,
        height: 900,
        id: assetId,
        mimeType: fetched.mimeType,
        objectKey,
        publicUrl,
        status: "ready",
        storageProvider: "s3",
        tenantId: input.tenantId,
        width: 900,
      });
      assets.push({ id: assetId, publicUrl });
    }
    return assets;
  }

  return {
    async linkUsages(input: {
      assets: SeededMediaAsset[];
      productId: string;
      tenantId: string;
      thumbnailUrl: string;
    }) {
      const rows = input.assets
        .filter((asset): asset is SeededMediaAsset & { id: string; publicUrl: string } =>
          Boolean(asset.id && asset.publicUrl),
        )
        .map((asset, position) => ({
          field: "images",
          isPrimary: asset.publicUrl === input.thumbnailUrl || position === 0,
          mediaAssetId: asset.id,
          position,
          resourceId: input.productId,
          resourceType: "product" as const,
          tenantId: input.tenantId,
        }));
      if (rows.length) await options.db.insert(mediaUsages).values(rows);
    },
    logConfig() {
      const config = getConfig();
      if (!config) {
        console.warn(
          "[seed:demo] MEDIA_S3_BUCKET / ACCESS_KEY / SECRET not set — product images will use remote fallback URLs only.",
        );
        return;
      }
      console.info(
        `[seed:demo] Media S3: bucket=${config.bucket} apiEndpoint=${config.endpoint ?? "(default AWS)"} publicBase=${config.publicBaseUrl ?? "(none)"} pathStyle=${config.forcePathStyle}`,
      );
    },
    async resetTenant(tenantId: string) {
      await options.db.delete(mediaUsages).where(eq(mediaUsages.tenantId, tenantId));
      await options.db.delete(mediaAssets).where(eq(mediaAssets.tenantId, tenantId));
    },
    seedProductAssets,
  };
}
