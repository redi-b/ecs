import {
  type MerchantQuotation,
  type MerchantQuotationRevision,
  type MerchantQuotationSnapshot,
  type MerchantQuotationStatus,
  type MerchantQuotationSummary,
  merchantQuotationTotal,
} from "@ecs/contracts";
import {
  type createPlatformDb,
  merchantQuotationCounters,
  merchantQuotationRevisions,
  merchantQuotations,
} from "@ecs/db";
import { and, count, desc, eq, sql } from "drizzle-orm";

type PlatformDatabase = ReturnType<typeof createPlatformDb>["db"];

type QuotationRow = {
  convertedOrderId: string | null;
  createdAt: Date;
  currentRevision: number;
  id: string;
  number: string;
  status: string;
  updatedAt: Date;
};

function customerLabel(snapshot: MerchantQuotationSnapshot) {
  const name = [snapshot.customer.firstName, snapshot.customer.lastName].filter(Boolean).join(" ");
  return name || snapshot.customer.phone || snapshot.customer.email || null;
}

function mapQuotation(row: QuotationRow, snapshot: MerchantQuotationSnapshot): MerchantQuotation {
  return {
    convertedOrderId: row.convertedOrderId,
    createdAt: row.createdAt.toISOString(),
    currentRevision: row.currentRevision,
    id: row.id,
    number: row.number,
    snapshot,
    status: row.status as MerchantQuotationStatus,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function createMerchantQuotationStore(db: PlatformDatabase) {
  return {
    async get(input: { quotationId: string; tenantId: string }) {
      const [row] = await db
        .select()
        .from(merchantQuotations)
        .where(
          and(
            eq(merchantQuotations.id, input.quotationId),
            eq(merchantQuotations.tenantId, input.tenantId),
          ),
        )
        .limit(1);
      if (!row) return null;
      const revisions = await db
        .select()
        .from(merchantQuotationRevisions)
        .where(
          and(
            eq(merchantQuotationRevisions.quotationId, row.id),
            eq(merchantQuotationRevisions.tenantId, input.tenantId),
          ),
        )
        .orderBy(desc(merchantQuotationRevisions.revision));
      const current = revisions[0];
      if (!current) return null;
      return {
        quotation: mapQuotation(row, current.snapshot as MerchantQuotationSnapshot),
        revisions: revisions.map(
          (revision): MerchantQuotationRevision => ({
            createdAt: revision.createdAt.toISOString(),
            createdByUserId: revision.createdByUserId,
            revision: revision.revision,
            snapshot: revision.snapshot as MerchantQuotationSnapshot,
          }),
        ),
      };
    },

    async issue(input: {
      createdByUserId: string;
      snapshot: MerchantQuotationSnapshot;
      tenantId: string;
    }) {
      return db.transaction(async (tx) => {
        const [counter] = await tx
          .insert(merchantQuotationCounters)
          .values({ nextNumber: 2, tenantId: input.tenantId })
          .onConflictDoUpdate({
            set: { nextNumber: sql`${merchantQuotationCounters.nextNumber} + 1` },
            target: merchantQuotationCounters.tenantId,
          })
          .returning({ nextNumber: merchantQuotationCounters.nextNumber });
        const allocated = (counter?.nextNumber ?? 2) - 1;
        const number = `Q-${String(allocated).padStart(6, "0")}`;
        const [row] = await tx
          .insert(merchantQuotations)
          .values({ number, tenantId: input.tenantId })
          .returning();
        if (!row) throw new Error("quotation_create_failed");
        await tx.insert(merchantQuotationRevisions).values({
          createdByUserId: input.createdByUserId,
          quotationId: row.id,
          revision: 1,
          snapshot: input.snapshot,
          tenantId: input.tenantId,
        });
        return mapQuotation(row, input.snapshot);
      });
    },

    async list(input: { limit: number; offset: number; tenantId: string }) {
      const rows = await db
        .select()
        .from(merchantQuotations)
        .where(eq(merchantQuotations.tenantId, input.tenantId))
        .orderBy(desc(merchantQuotations.updatedAt))
        .limit(input.limit)
        .offset(input.offset);
      const [{ value = 0 } = {}] = await db
        .select({ value: count() })
        .from(merchantQuotations)
        .where(eq(merchantQuotations.tenantId, input.tenantId));
      const quotations: MerchantQuotationSummary[] = [];
      for (const row of rows) {
        const [revision] = await db
          .select({ snapshot: merchantQuotationRevisions.snapshot })
          .from(merchantQuotationRevisions)
          .where(
            and(
              eq(merchantQuotationRevisions.quotationId, row.id),
              eq(merchantQuotationRevisions.revision, row.currentRevision),
              eq(merchantQuotationRevisions.tenantId, input.tenantId),
            ),
          )
          .limit(1);
        if (!revision) continue;
        const snapshot = revision.snapshot as MerchantQuotationSnapshot;
        quotations.push({
          convertedOrderId: row.convertedOrderId,
          createdAt: row.createdAt.toISOString(),
          currentRevision: row.currentRevision,
          customerLabel: customerLabel(snapshot),
          expiresAt: snapshot.expiresAt,
          id: row.id,
          number: row.number,
          status: row.status as MerchantQuotationStatus,
          total: merchantQuotationTotal(snapshot),
          updatedAt: row.updatedAt.toISOString(),
        });
      }
      return { count: Number(value), quotations };
    },

    async markConverted(input: { orderId: string; quotationId: string; tenantId: string }) {
      const [row] = await db
        .update(merchantQuotations)
        .set({ convertedOrderId: input.orderId, status: "converted", updatedAt: new Date() })
        .where(
          and(
            eq(merchantQuotations.id, input.quotationId),
            eq(merchantQuotations.tenantId, input.tenantId),
          ),
        )
        .returning();
      return row ?? null;
    },

    async revise(input: {
      createdByUserId: string;
      expectedRevision: number;
      quotationId: string;
      snapshot: MerchantQuotationSnapshot;
      tenantId: string;
    }) {
      return db.transaction(async (tx) => {
        const [row] = await tx
          .update(merchantQuotations)
          .set({
            currentRevision: input.expectedRevision + 1,
            status: "issued",
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(merchantQuotations.id, input.quotationId),
              eq(merchantQuotations.tenantId, input.tenantId),
              eq(merchantQuotations.currentRevision, input.expectedRevision),
            ),
          )
          .returning();
        if (!row) return null;
        await tx.insert(merchantQuotationRevisions).values({
          createdByUserId: input.createdByUserId,
          quotationId: row.id,
          revision: row.currentRevision,
          snapshot: input.snapshot,
          tenantId: input.tenantId,
        });
        return mapQuotation(row, input.snapshot);
      });
    },
  };
}

export function addQuoteValidityDays(now: Date, days = 14) {
  return new Date(now.getTime() + days * 86_400_000).toISOString();
}
