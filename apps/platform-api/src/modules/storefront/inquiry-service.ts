import type { createPlatformDb } from "@ecs/db";
import { storefrontInquiries } from "@ecs/db";
import { and, count, desc, eq, gte, ilike, lte, or } from "drizzle-orm";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];

export type StorefrontInquiryInput = {
  customerEmail: string | null;
  customerName: string;
  customerPhone: string | null;
  details: Record<string, string>;
  message: string;
  sourcePath: string | null;
  subject: string;
  tenantId: string;
  type: "contact" | "product_request";
};

export function createStorefrontInquiryService(db: PlatformDb) {
  const serialize = (row: typeof storefrontInquiries.$inferSelect) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });

  return {
    createInquiry: async (input: StorefrontInquiryInput) => {
      const [inquiry] = await db
        .insert(storefrontInquiries)
        .values(input)
        .returning({ id: storefrontInquiries.id, createdAt: storefrontInquiries.createdAt });

      if (!inquiry) throw new Error("Storefront inquiry insert returned no rows.");
      return {
        ok: true as const,
        inquiry: { id: inquiry.id, createdAt: inquiry.createdAt.toISOString() },
      };
    },
    listInquiries: async (input: {
      createdFrom?: string | undefined;
      createdTo?: string | undefined;
      limit: number;
      offset: number;
      q?: string | undefined;
      status?: string | undefined;
      tenantId: string;
      type?: string | undefined;
    }) => {
      const filters = [eq(storefrontInquiries.tenantId, input.tenantId)];
      if (input.createdFrom)
        filters.push(gte(storefrontInquiries.createdAt, new Date(input.createdFrom)));
      if (input.createdTo)
        filters.push(lte(storefrontInquiries.createdAt, new Date(input.createdTo)));
      if (input.status) filters.push(eq(storefrontInquiries.status, input.status));
      if (input.type) filters.push(eq(storefrontInquiries.type, input.type));
      if (input.q) {
        const pattern = `%${input.q}%`;
        filters.push(
          or(
            ilike(storefrontInquiries.customerName, pattern),
            ilike(storefrontInquiries.customerEmail, pattern),
            ilike(storefrontInquiries.customerPhone, pattern),
            ilike(storefrontInquiries.subject, pattern),
          )!,
        );
      }
      const where = and(...filters);
      const [rows, totals] = await Promise.all([
        db
          .select()
          .from(storefrontInquiries)
          .where(where)
          .orderBy(desc(storefrontInquiries.createdAt), desc(storefrontInquiries.id))
          .limit(input.limit)
          .offset(input.offset),
        db.select({ value: count() }).from(storefrontInquiries).where(where),
      ]);
      return {
        ok: true as const,
        inquiries: rows.map(serialize),
        count: totals[0]?.value ?? 0,
        limit: input.limit,
        offset: input.offset,
      };
    },
    getInquiry: async (input: { inquiryId: string; tenantId: string }) => {
      const [row] = await db
        .select()
        .from(storefrontInquiries)
        .where(
          and(
            eq(storefrontInquiries.id, input.inquiryId),
            eq(storefrontInquiries.tenantId, input.tenantId),
          ),
        )
        .limit(1);
      return row
        ? { ok: true as const, inquiry: serialize(row) }
        : { ok: false as const, error: "inquiry_not_found" as const, status: 404 as const };
    },
    updateInquiryStatus: async (input: {
      inquiryId: string;
      status: "new" | "read" | "resolved" | "archived";
      tenantId: string;
    }) => {
      const [row] = await db
        .update(storefrontInquiries)
        .set({ status: input.status, updatedAt: new Date() })
        .where(
          and(
            eq(storefrontInquiries.id, input.inquiryId),
            eq(storefrontInquiries.tenantId, input.tenantId),
          ),
        )
        .returning();
      return row
        ? { ok: true as const, inquiry: serialize(row) }
        : { ok: false as const, error: "inquiry_not_found" as const, status: 404 as const };
    },
  };
}

export type StorefrontInquiryService = ReturnType<typeof createStorefrontInquiryService>;
