import type { Context, Hono } from "hono";

import type { PlatformAppOptions, PlatformAppVariables, PlatformSession } from "../../app.js";
import type { TenantResolutionResult } from "../../tenancy/tenant-resolver.js";
import { getRequestHost, storeErrorStatus } from "../shared.js";

export type MerchantRouteApp = Hono<{ Variables: PlatformAppVariables }>;

export type ResolvedMerchantCommerceContext = {
  medusaStoreId: string;
  medusaSalesChannelId: string;
  medusaStockLocationId: string | null;
  medusaRegionId: string | null;
};

export type AuthorizedMerchantContext =
  | {
      ok: true;
      authorization: NonNullable<
        Awaited<ReturnType<NonNullable<PlatformAppOptions["authorizeDashboardForTenant"]>>>
      > & { ok: true };
      result: Extract<TenantResolutionResult, { ok: true }>;
      session: PlatformSession;
    }
  | {
      ok: false;
      response: Response;
    };

export function createMerchantRouteHelpers(options: PlatformAppOptions) {
  async function getAuthorizedMerchantContext(
    context: Context<{ Variables: PlatformAppVariables }>,
  ): Promise<AuthorizedMerchantContext> {
    const session = await options.getSession?.(context.req.raw.headers);

    if (!session) {
      return {
        ok: false as const,
        response: context.json({ error: "auth_required" }, 401),
      };
    }

    const host = getRequestHost(
      context.req.header("x-forwarded-host") ?? context.req.header("host"),
    );
    const result = await options.resolveTenantForHost(host);

    if (!result.ok) {
      return {
        ok: false as const,
        response: context.json({ error: result.error }, storeErrorStatus[result.error]),
      };
    }

    const authorization = await options.authorizeDashboardForTenant?.({
      tenantId: result.context.tenantId,
      userId: session.user.id,
    });

    if (!authorization?.ok) {
      return {
        ok: false as const,
        response: context.json({ error: "dashboard_forbidden" }, 403),
      };
    }

    return {
      ok: true as const,
      authorization,
      result,
      session,
    };
  }

  function getResolvedCommerce(
    context: {
      medusaStoreId: string | null;
      medusaSalesChannelId: string | null;
      medusaStockLocationId: string | null;
      medusaRegionId: string | null;
    },
    requirements?: {
      requireRegion?: boolean | undefined;
      requireStockLocation?: boolean | undefined;
    },
  ):
    | {
        ok: true;
        context: ResolvedMerchantCommerceContext;
      }
    | {
        ok: false;
        error:
          | "commerce_store_unavailable"
          | "commerce_sales_channel_unavailable"
          | "inventory_location_unavailable"
          | "commerce_region_unavailable";
        status: 503;
      } {
    if (!context.medusaStoreId) {
      return { ok: false, error: "commerce_store_unavailable", status: 503 };
    }

    if (!context.medusaSalesChannelId) {
      return { ok: false, error: "commerce_sales_channel_unavailable", status: 503 };
    }

    if (requirements?.requireStockLocation && !context.medusaStockLocationId) {
      return { ok: false, error: "inventory_location_unavailable", status: 503 };
    }

    if (requirements?.requireRegion && !context.medusaRegionId) {
      return { ok: false, error: "commerce_region_unavailable", status: 503 };
    }

    return {
      ok: true,
      context: {
        medusaStoreId: context.medusaStoreId,
        medusaSalesChannelId: context.medusaSalesChannelId,
        medusaStockLocationId: context.medusaStockLocationId,
        medusaRegionId: context.medusaRegionId,
      },
    };
  }

  return {
    getAuthorizedMerchantContext,
    getResolvedCommerce,
  };
}

export type MerchantRouteHelpers = ReturnType<typeof createMerchantRouteHelpers>;
