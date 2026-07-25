/**
 * Upload vendored bank logos to media storage and set payment_banks.logo_url.
 *
 *   pnpm seed:bank-logos
 *   pnpm seed:bank-logos -- --fetch   # re-download missing from ethiopianlogos
 *
 * Assets: assets/bank-logos/  ·  License: third-party/ethiopianlogos-MIT.txt
 * Requires PLATFORM_DATABASE_URL + MEDIA_S3_* (use MEDIA_S3_INTERNAL_ENDPOINT in Docker).
 */
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createPlatformDb, paymentBanks } from "@ecs/db";
import { eq } from "drizzle-orm";

import { loadPlatformApiEnvFiles } from "../config/env.js";
import {
  ETHIOPIAN_BANK_CATALOG,
  ETHIOPIAN_LOGOS_COMMIT,
  bankLogoObjectKey,
  bankLogoPublicUrl,
  ethiopianLogosSourceSvgUrl,
} from "../lib/settlement.js";

loadPlatformApiEnvFiles();

const forceFetch = process.argv.includes("--fetch");
const assetsDir = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../assets/bank-logos",
);

function resolveMediaS3ApiEndpoint() {
  const internal = process.env.MEDIA_S3_INTERNAL_ENDPOINT?.trim();
  if (internal) return internal.replace(/\/$/, "");

  if (process.env.MEDIA_S3_USE_DOCKER_INTERNAL === "true") {
    return "http://seaweedfs:8333";
  }

  const publicEndpoint = process.env.MEDIA_S3_ENDPOINT?.trim();
  if (
    publicEndpoint &&
    (publicEndpoint.includes("media.") || publicEndpoint.startsWith("https://")) &&
    (process.env.HOSTNAME === "platform-api" ||
      process.env.SERVICE_NAME === "platform-api" ||
      Boolean(process.env.PLATFORM_DATABASE_URL?.includes("@postgres")))
  ) {
    return "http://seaweedfs:8333";
  }

  return publicEndpoint?.replace(/\/$/, "") || undefined;
}

function getMediaS3Config() {
  const bucket = process.env.MEDIA_S3_BUCKET?.trim();
  const accessKeyId = process.env.MEDIA_S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.MEDIA_S3_SECRET_ACCESS_KEY?.trim();
  if (!bucket || !accessKeyId || !secretAccessKey) return null;

  const forcePathStyleEnv = process.env.MEDIA_S3_FORCE_PATH_STYLE?.trim().toLowerCase();
  const forcePathStyle =
    forcePathStyleEnv === "true" ||
    forcePathStyleEnv === "1" ||
    (forcePathStyleEnv !== "false" && Boolean(resolveMediaS3ApiEndpoint()));

  return {
    accessKeyId,
    bucket,
    endpoint: resolveMediaS3ApiEndpoint(),
    forcePathStyle,
    publicBaseUrl: process.env.MEDIA_S3_PUBLIC_BASE_URL?.trim() || undefined,
    region: process.env.MEDIA_S3_REGION?.trim() || "us-east-1",
    secretAccessKey,
  };
}

function createSeedS3Client(config: NonNullable<ReturnType<typeof getMediaS3Config>>) {
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

function formatS3Error(error: unknown) {
  if (!error || typeof error !== "object") return String(error);
  const err = error as {
    message?: string;
    name?: string;
    Code?: string;
    $metadata?: { httpStatusCode?: number };
  };
  return (
    [err.name, err.Code, err.$metadata?.httpStatusCode, err.message].filter(Boolean).join(" ") ||
    String(error)
  );
}

async function ensureCatalogRows(
  db: ReturnType<typeof createPlatformDb>["db"],
  publicBaseUrl: string | undefined,
) {
  const existing = await db.select({ code: paymentBanks.code }).from(paymentBanks);
  const have = new Set(existing.map((row) => row.code));
  const missing = ETHIOPIAN_BANK_CATALOG.filter((entry) => !have.has(entry.code));
  if (missing.length === 0) return;

  await db
    .insert(paymentBanks)
    .values(
      missing.map((entry) => ({
        code: entry.code,
        name: entry.name,
        kind: entry.kind,
        logoUrl:
          publicBaseUrl && entry.logoSource
            ? bankLogoPublicUrl(publicBaseUrl, entry.code)
            : null,
        sortOrder: entry.sortOrder,
        isActive: true,
      })),
    )
    .onConflictDoNothing();

  console.log(`[seed:bank-logos] Inserted ${missing.length} missing payment_banks row(s).`);
}

async function main() {
  const config = getMediaS3Config();
  if (!config) {
    console.error(
      "[seed:bank-logos] MEDIA_S3_BUCKET / ACCESS_KEY_ID / SECRET_ACCESS_KEY required.",
    );
    process.exit(1);
  }
  if (!config.publicBaseUrl) {
    console.error(
      "[seed:bank-logos] MEDIA_S3_PUBLIC_BASE_URL is required so logo_url can be set for the browser.",
    );
    process.exit(1);
  }

  const platformDb = createPlatformDb({
    connectionString:
      process.env.PLATFORM_DATABASE_URL ?? "postgres://ecs:ecs@localhost:5432/platform_db",
    max: Number.parseInt(process.env.PLATFORM_DATABASE_POOL_MAX ?? "5", 10),
    idleTimeoutMillis: Number.parseInt(
      process.env.PLATFORM_DATABASE_POOL_IDLE_TIMEOUT_MS ?? "30000",
      10,
    ),
  });

  console.log(
    `[seed:bank-logos] Source: ethiopianlogos@${ETHIOPIAN_LOGOS_COMMIT.slice(0, 12)} (MIT)`,
  );
  console.log(
    `[seed:bank-logos] S3: bucket=${config.bucket} api=${config.endpoint ?? "(default)"} public=${config.publicBaseUrl}`,
  );

  try {
    await ensureCatalogRows(platformDb.db, config.publicBaseUrl);

    const client = createSeedS3Client(config);
    const withSource = ETHIOPIAN_BANK_CATALOG.filter((entry) => entry.logoSource);
    let uploaded = 0;
    let failed = 0;
    let skipped = 0;

    for (const entry of withSource) {
      const logoSource = entry.logoSource!;
      const objectKey = bankLogoObjectKey(entry.code);
      const publicUrl = bankLogoPublicUrl(config.publicBaseUrl, entry.code);
      const localPath = resolve(assetsDir, `${entry.code}.svg`);

      let bytes: Buffer | null = null;
      if (!forceFetch && existsSync(localPath)) {
        bytes = readFileSync(localPath);
        console.log(`[seed:bank-logos] local ${entry.code} (${bytes.byteLength} B)`);
      } else {
        const sourceUrl = ethiopianLogosSourceSvgUrl(logoSource);
        try {
          const response = await fetch(sourceUrl, {
            redirect: "follow",
            signal: AbortSignal.timeout(20_000),
            headers: { accept: "image/svg+xml,*/*" },
          });
          if (!response.ok) {
            console.warn(
              `[seed:bank-logos] FETCH fail ${entry.code} (${response.status}) ${sourceUrl}`,
            );
            failed += 1;
            continue;
          }
          bytes = Buffer.from(await response.arrayBuffer());
          console.log(`[seed:bank-logos] fetched ${entry.code} (${bytes.byteLength} B)`);
        } catch (error) {
          console.warn(
            `[seed:bank-logos] FETCH error ${entry.code}: ${error instanceof Error ? error.message : String(error)}`,
          );
          failed += 1;
          continue;
        }
      }

      if (!bytes || bytes.byteLength < 32) {
        console.warn(`[seed:bank-logos] empty ${entry.code}`);
        failed += 1;
        continue;
      }
      const head = bytes.toString("utf8", 0, Math.min(bytes.byteLength, 200)).toLowerCase();
      if (!head.includes("<svg") && !head.includes("<?xml")) {
        console.warn(`[seed:bank-logos] not SVG ${entry.code}`);
        failed += 1;
        continue;
      }

      try {
        await client.send(
          new PutObjectCommand({
            Body: bytes,
            Bucket: config.bucket,
            ContentType: "image/svg+xml",
            Key: objectKey,
          }),
        );
      } catch (error) {
        console.warn(
          `[seed:bank-logos] PUT fail ${entry.code} → ${objectKey}: ${formatS3Error(error)}`,
        );
        failed += 1;
        continue;
      }

      await platformDb.db
        .update(paymentBanks)
        .set({ logoUrl: publicUrl, updatedAt: new Date() })
        .where(eq(paymentBanks.code, entry.code));

      console.log(`[seed:bank-logos] OK ${entry.code} → ${publicUrl}`);
      uploaded += 1;
    }

    const noSource = ETHIOPIAN_BANK_CATALOG.filter((entry) => !entry.logoSource);
    skipped = noSource.length;
    if (noSource.length > 0) {
      console.log(
        `[seed:bank-logos] No open-source asset (placeholder UI): ${noSource.map((e) => e.code).join(", ")}`,
      );
    }

    console.log(
      `[seed:bank-logos] Done. uploaded=${uploaded} failed=${failed} no_source=${skipped}`,
    );
    if (failed > 0) process.exitCode = 1;
  } finally {
    await platformDb.pool.end();
  }
}

main().catch((error) => {
  console.error("[seed:bank-logos] Fatal:", error);
  process.exit(1);
});
