import type { createPlatformDb } from "@ecs/db";
import { tenants } from "@ecs/db";
import { eq } from "drizzle-orm";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];

/**
 * Map a Medusa sales channel id to the owning platform tenant.
 * Used by internal notification ingest so Medusa subscribers need not
 * reverse-lookup tenants themselves.
 */
export function createResolveTenantIdByMedusaSalesChannel(db: PlatformDb) {
  return async (salesChannelId: string): Promise<string | null> => {
    const trimmed = salesChannelId.trim();
    if (!trimmed) {
      return null;
    }

    const [row] = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.medusaSalesChannelId, trimmed))
      .limit(1);

    return row?.id ?? null;
  };
}
