import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  DEFAULT_MEDIA_LIMITS,
  type MediaLimitsConfig,
  getMediaUploadConfig,
} from "../../lib/merchant-media.js";
import {
  formatConstraintsBadge,
  formatMimeTypeLabel,
  validateMediaFiles,
} from "./product-media-dropzone.js";

test("formatMimeTypeLabel maps standard image MIME types to readable names", () => {
  assert.equal(formatMimeTypeLabel("image/jpeg"), "JPEG");
  assert.equal(formatMimeTypeLabel("image/png"), "PNG");
  assert.equal(formatMimeTypeLabel("image/webp"), "WebP");
  assert.equal(formatMimeTypeLabel("image/gif"), "GIF");
  assert.equal(formatMimeTypeLabel("image/avif"), "AVIF");
  assert.equal(formatMimeTypeLabel("image/svg+xml"), "SVG+XML");
});

test("formatConstraintsBadge renders constraint text according to config", () => {
  const badge1 = formatConstraintsBadge(DEFAULT_MEDIA_LIMITS);
  assert.equal(badge1, "Max 15MB per file • Up to 10 files • JPEG, PNG, WebP, GIF, AVIF");

  const customConfig: MediaLimitsConfig = {
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    formattedMaxSize: "20MB",
    maxFileBytes: 20 * 1024 * 1024,
    maxFilesPerBatch: 5,
  };
  const badge2 = formatConstraintsBadge(customConfig);
  assert.equal(badge2, "Max 20MB per file • Up to 5 files • JPEG, PNG, WebP");
});

test("validateMediaFiles validates file count against maxFilesPerBatch", () => {
  const config: MediaLimitsConfig = {
    ...DEFAULT_MEDIA_LIMITS,
    maxFilesPerBatch: 2,
  };

  const files = [
    new File(["content1"], "a.jpg", { type: "image/jpeg" }),
    new File(["content2"], "b.jpg", { type: "image/jpeg" }),
    new File(["content3"], "c.jpg", { type: "image/jpeg" }),
  ];

  const result = validateMediaFiles(files, config);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((err) => err.includes("maximum 2 files allowed per batch")));
});

test("validateMediaFiles rejects files exceeding maxFileBytes", () => {
  const config: MediaLimitsConfig = {
    ...DEFAULT_MEDIA_LIMITS,
    formattedMaxSize: "100B",
    maxFileBytes: 100,
  };

  const smallFile = new File(["small"], "small.jpg", { type: "image/jpeg" });
  const largeFile = new File([new Uint8Array(200)], "large.jpg", { type: "image/jpeg" });

  const result = validateMediaFiles([smallFile, largeFile], config);
  assert.equal(result.valid, false);
  assert.equal(result.acceptedFiles.length, 1);
  assert.equal(result.rejectedFiles.length, 1);
  assert.equal(result.rejectedFiles[0]?.file.name, "large.jpg");
  assert.ok(result.rejectedFiles[0]?.reason.includes("exceeds maximum size"));
});

test("validateMediaFiles rejects unsupported MIME types", () => {
  const config: MediaLimitsConfig = {
    ...DEFAULT_MEDIA_LIMITS,
    allowedMimeTypes: ["image/jpeg", "image/png"],
  };

  const pdfFile = new File(["pdf"], "doc.pdf", { type: "application/pdf" });
  const jpegFile = new File(["jpeg"], "pic.jpg", { type: "image/jpeg" });

  const result = validateMediaFiles([pdfFile, jpegFile], config);
  assert.equal(result.valid, false);
  assert.equal(result.acceptedFiles.length, 1);
  assert.equal(result.rejectedFiles.length, 1);
  assert.equal(result.rejectedFiles[0]?.file.name, "doc.pdf");
  assert.ok(result.rejectedFiles[0]?.reason.includes("unsupported type"));
});

test("validateMediaFiles accepts valid batch of files", () => {
  const files = [
    new File(["img1"], "1.png", { type: "image/png" }),
    new File(["img2"], "2.webp", { type: "image/webp" }),
  ];

  const result = validateMediaFiles(files, DEFAULT_MEDIA_LIMITS);
  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
  assert.equal(result.acceptedFiles.length, 2);
  assert.equal(result.rejectedFiles.length, 0);
});

test("getMediaUploadConfig falls back to default limits when fetch fails", async () => {
  const config = await getMediaUploadConfig({
    platformApiBaseUrl: "http://127.0.0.1:59999", // Unreachable port
  });
  assert.deepEqual(config, DEFAULT_MEDIA_LIMITS);
});

test("ProductMediaDropzone component renders badge and dropzone markup", async () => {
  const source = await readFile(new URL("./product-media-dropzone.tsx", import.meta.url), "utf8");
  assert.match(source, /formatConstraintsBadge/);
  assert.match(source, /validateMediaFiles/);
  assert.match(source, /data-testid="media-constraints-badge"/);
  assert.match(source, /onFilesSelected/);
  assert.match(source, /onFilesRejected/);
});
