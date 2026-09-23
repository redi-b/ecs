import assert from "node:assert/strict";
import test from "node:test";

import { getMediaLimitsConfig } from "../../adapters/storage/env.js";

test("getMediaLimitsConfig returns default constraints when env vars unset", () => {
  const config = getMediaLimitsConfig({});
  assert.equal(config.maxFileBytes, 15 * 1024 * 1024);
  assert.equal(config.maxFilesPerBatch, 10);
  assert.equal(config.formattedMaxSize, "15MB");
  assert.ok(config.allowedMimeTypes.includes("image/webp"));
  assert.deepEqual(config.allowedMimeTypes, [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/avif",
  ]);
});

test("getMediaLimitsConfig parses custom env values", () => {
  const config = getMediaLimitsConfig({
    MEDIA_ALLOWED_MIME_TYPES: "image/jpeg, image/png, image/webp",
    MEDIA_MAX_FILE_BYTES: "20971520",
    MEDIA_MAX_FILES_PER_BATCH: "5",
  });
  assert.equal(config.maxFileBytes, 20971520);
  assert.equal(config.maxFilesPerBatch, 5);
  assert.equal(config.formattedMaxSize, "20MB");
  assert.deepEqual(config.allowedMimeTypes, ["image/jpeg", "image/png", "image/webp"]);
});

test("media config endpoints return JSON constraints", async () => {
  const { createPlatformApp } = await import("../../app.js");
  const app = createPlatformApp({
    authorizeDashboardForTenant: async () => ({
      actor: { email: "owner@example.com", id: "user_1", name: "Owner", role: "owner" },
      ok: true,
    }),
    getSession: async () => null,
    medusaInternalUrl: "http://medusa:9000",
    platformPublicBaseUrl: "http://api.example.com",
    resolveTenantForHost: async () => ({ error: "shop_not_found", ok: false }),
    serviceName: "platform-api",
  });

  const res1 = await app.request("http://shop.example.com/platform/merchant/media/config");
  assert.equal(res1.status, 200);
  const data1 = (await res1.json()) as any;
  assert.equal(typeof data1.maxFileBytes, "number");
  assert.equal(typeof data1.maxFilesPerBatch, "number");
  assert.equal(typeof data1.formattedMaxSize, "string");
  assert.ok(Array.isArray(data1.allowedMimeTypes));

  const res2 = await app.request("http://shop.example.com/api/v1/media/config");
  assert.equal(res2.status, 200);
  const data2 = (await res2.json()) as any;
  assert.deepEqual(data2, data1);
});

