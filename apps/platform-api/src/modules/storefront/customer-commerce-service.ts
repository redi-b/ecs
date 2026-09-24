import type { createPlatformDb } from "@ecs/db";
import { customerCommerceStates } from "@ecs/db";
import { and, eq } from "drizzle-orm";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];

export type CustomerWishlistEntry = {
  path: string;
  title: string;
  thumbnail: string | null;
  priceAmount: number | null;
  currencyCode: string | null;
};

type CustomerKey = { tenantId: string; customerId: string };

export function createCustomerCommerceService(db: PlatformDb) {
  const whereCustomer = (key: CustomerKey) => and(
    eq(customerCommerceStates.tenantId, key.tenantId),
    eq(customerCommerceStates.medusaCustomerId, key.customerId),
  );

  const getState = async (key: CustomerKey) => {
    const [row] = await db.select().from(customerCommerceStates).where(whereCustomer(key)).limit(1);
    return {
      activeCartId: row?.activeCartId ?? null,
      wishlist: normalizeWishlist(row?.wishlist),
    };
  };

  const updateState = async (
    key: CustomerKey,
    values: { activeCartId?: string | null; wishlist?: CustomerWishlistEntry[] },
  ) => {
    const [row] = await db
      .insert(customerCommerceStates)
      .values({
        tenantId: key.tenantId,
        medusaCustomerId: key.customerId,
        activeCartId: values.activeCartId ?? null,
        wishlist: values.wishlist ?? [],
      })
      .onConflictDoUpdate({
        target: [customerCommerceStates.tenantId, customerCommerceStates.medusaCustomerId],
        set: {
          ...(values.activeCartId !== undefined ? { activeCartId: values.activeCartId } : {}),
          ...(values.wishlist !== undefined ? { wishlist: values.wishlist } : {}),
          updatedAt: new Date(),
        },
      })
      .returning();
    return {
      activeCartId: row?.activeCartId ?? null,
      wishlist: normalizeWishlist(row?.wishlist),
    };
  };

  return { getState, updateState };
}

function normalizeWishlist(value: unknown): CustomerWishlistEntry[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const item = entry as Record<string, unknown>;
    if (typeof item.path !== "string" || !item.path.startsWith("/products/")) return [];
    return [{
      path: item.path.slice(0, 500),
      title: typeof item.title === "string" ? item.title.slice(0, 200) : "Product",
      thumbnail: typeof item.thumbnail === "string" ? item.thumbnail.slice(0, 2_000) : null,
      priceAmount: typeof item.priceAmount === "number" && Number.isFinite(item.priceAmount) ? item.priceAmount : null,
      currencyCode: typeof item.currencyCode === "string" ? item.currencyCode.slice(0, 10) : null,
    }];
  }).slice(0, 200);
}

export type CustomerCommerceService = ReturnType<typeof createCustomerCommerceService>;
