import { CreateBucketCommand, HeadBucketCommand } from "@aws-sdk/client-s3";

type S3BucketClient = {
  send(command: CreateBucketCommand | HeadBucketCommand): Promise<unknown>;
};

export type EnsureS3BucketResult = { created: boolean; ok: true } | { error: unknown; ok: false };

/** Ensure a configured S3 bucket is usable before publishing URLs into demo data. */
export async function ensureS3Bucket(
  client: S3BucketClient,
  bucket: string,
): Promise<EnsureS3BucketResult> {
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    return { created: false, ok: true };
  } catch {
    // Missing buckets are expected on a fresh SeaweedFS volume. CreateBucket is
    // also safe against the startup race because the final HeadBucket is the
    // source of truth.
  }

  try {
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    return { created: true, ok: true };
  } catch (error) {
    return { error, ok: false };
  }
}
