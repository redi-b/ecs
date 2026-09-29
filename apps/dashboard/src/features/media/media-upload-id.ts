import { createClientId } from "@/lib/client-id";

export function createMediaUploadId(
  cryptoLike: Parameters<typeof createClientId>[1] = globalThis.crypto,
) {
  return createClientId("upload", cryptoLike);
}
