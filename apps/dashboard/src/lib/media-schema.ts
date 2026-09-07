import { z } from "zod";

export const mediaAssetSchema = z.object({
  accessMode: z.enum(["public", "private"]),
  altText: z.string().nullable(),
  byteSize: z.number(),
  createdAt: z.string(),
  displayName: z.string(),
  filename: z.string(),
  height: z.number().nullable(),
  id: z.string().min(1),
  mimeType: z.string(),
  publicUrl: z.string().nullable(),
  status: z.enum(["pending", "uploaded", "processing", "ready", "failed", "deleted"]),
  updatedAt: z.string(),
  width: z.number().nullable(),
});
