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
  endpoint?: string | undefined;
  forcePathStyle?: boolean | undefined;
  publicBaseUrl?: string | undefined;
  region: string;
  secretAccessKey: string;
  uploadUrlTtlSeconds?: number | undefined;
};

export function createS3StorageAdapter(options: S3StorageOptions): StorageAdapter {
  const client = new S3Client({
    credentials: {
      accessKeyId: options.accessKeyId,
      secretAccessKey: options.secretAccessKey,
    },
    ...(options.endpoint ? { endpoint: options.endpoint } : {}),
    forcePathStyle: options.forcePathStyle ?? false,
    region: options.region,
  });

  return {
    bucket: options.bucket,
    provider: "s3",
    async createUpload(input) {
      const command = new PutObjectCommand({
        Bucket: options.bucket,
        ContentLength: input.byteSize,
        ContentType: input.mimeType,
        Key: input.objectKey,
      });
      const uploadUrl = await getSignedUrl(client, command, {
        expiresIn: options.uploadUrlTtlSeconds ?? 900,
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
      await client.send(new DeleteObjectCommand({ Bucket: options.bucket, Key: objectKey }));
    },
    async getObjectMetadata(objectKey) {
      try {
        const result = await client.send(
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
