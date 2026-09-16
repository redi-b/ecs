import { createHash } from "node:crypto";

const PUBLIC_HANDLE_METADATA_KEY = "platform_public_handle";

function getTenantHandlePrefix(tenantId: string) {
  const namespace = createHash("sha256").update(tenantId.trim()).digest("hex").slice(0, 12);
  return `ecs-${namespace}-`;
}

/**
 * Medusa product handles are globally unique. Prefix the merchant-facing handle with a stable,
 * opaque tenant namespace so two shops can use the same storefront URL handle independently.
 */
export function getTenantProductHandle(tenantId: string, publicHandle: string) {
  const prefix = getTenantHandlePrefix(tenantId);
  const normalized = publicHandle.trim();
  return normalized.startsWith(prefix) ? normalized : `${prefix}${normalized}`;
}

export function getPublicProductHandle(input: {
  handle: string | null;
  metadata?: unknown;
  tenantId?: string | undefined;
}) {
  if (input.metadata && typeof input.metadata === "object" && !Array.isArray(input.metadata)) {
    const publicHandle = (input.metadata as Record<string, unknown>)[PUBLIC_HANDLE_METADATA_KEY];
    if (typeof publicHandle === "string" && publicHandle.trim()) {
      return publicHandle.trim();
    }
  }

  if (!input.handle || !input.tenantId?.trim()) return input.handle;
  const prefix = getTenantHandlePrefix(input.tenantId);
  return input.handle.startsWith(prefix) ? input.handle.slice(prefix.length) : input.handle;
}

export function getTenantProductMetadata(
  tenantId: string,
  publicHandle: string | null | undefined,
  metadata?: Record<string, unknown> | undefined,
) {
  return {
    ...metadata,
    platform_tenant_id: tenantId,
    ...(publicHandle?.trim()
      ? { [PUBLIC_HANDLE_METADATA_KEY]: publicHandle.trim() }
      : {}),
  };
}
