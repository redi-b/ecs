import {
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import type { StorageAdapter } from "./storage.js";

export type S3StorageOptions = {
  accessKeyId: string;
  bucket: string;
  /**
   * Public S3 API base used when minting browser presigned URLs
   * (e.g. https://media.example.com). Must match the Host clients PUT to.
   */
  endpoint?: string | undefined;
  forcePathStyle?: boolean | undefined;
  /**
   * In-network S3 API for server Head/Put/Delete (e.g. http://seaweedfs:8333).
   * Falls back to `endpoint` when unset.
   */
  internalEndpoint?: string | undefined;
  publicBaseUrl?: string | undefined;
  region: string;
  secretAccessKey: string;
  uploadUrlTtlSeconds?: number | undefined;
};

function createClient(options: S3StorageOptions, endpoint: string | undefined) {
  return new S3Client({
    credentials: {
      accessKeyId: options.accessKeyId,
      secretAccessKey: options.secretAccessKey,
    },
    ...(endpoint ? { endpoint } : {}),
    forcePathStyle: options.forcePathStyle ?? false,
    region: options.region,
    // AWS SDK v3 default flexible checksums (CRC32) break SeaweedFS/MinIO presigns:
    // browser PUTs omit those headers → SignatureDoesNotMatch / 4xx.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
}

export function createS3StorageAdapter(options: S3StorageOptions): StorageAdapter {
  // Presign with the public endpoint so Host + path match the browser request.
  const signClient = createClient(options, options.endpoint);
  // Server ops prefer the Docker-internal endpoint (no TLS / Host rewrite issues).
  const opsClient = createClient(options, options.internalEndpoint ?? options.endpoint);

  return {
    bucket: options.bucket,
    provider: "s3",
    async createUpload(input) {
      // Do not put ContentLength on the command — signing it forces the browser to
      // send an exact content-length that must match SigV4 (Uppy/fetch often differ).
      const command = new PutObjectCommand({
        Bucket: options.bucket,
        ContentType: input.mimeType,
        Key: input.objectKey,
      });
      const uploadUrl = await getSignedUrl(signClient, command, {
        expiresIn: options.uploadUrlTtlSeconds ?? 900,
        // S3 presigner treats content-type as unsignable by default; require it so the
        // client must send the same Content-Type the API created the asset with.
        signableHeaders: new Set(["content-type"]),
      });

      return {
        headers: {
          "content-type": input.mimeType,
        },
        method: "PUT",
        publicUrl:
          input.accessMode === "public" && options.publicBaseUrl
            ? `${options.publicBaseUrl.replace(/\/$/, "")}/${input.objectKey}`
            : null,
        uploadUrl,
      };
    },
    async deleteObject(objectKey) {
      await opsClient.send(new DeleteObjectCommand({ Bucket: options.bucket, Key: objectKey }));
    },
    async getObjectMetadata(objectKey) {
      try {
        const result = await opsClient.send(
          new HeadObjectCommand({ Bucket: options.bucket, Key: objectKey }),
        );

        return {
          byteSize: result.ContentLength ?? 0,
          contentType: result.ContentType ?? null,
        };
      } catch (error) {
        const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata
          ?.httpStatusCode;
        if (status === 404) return null;
        throw error;
      }
    },
  };
}
