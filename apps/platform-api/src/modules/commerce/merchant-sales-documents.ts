import { createHash } from "node:crypto";
import type { MerchantSalesDocument, MerchantSalesDocumentSnapshot } from "@ecs/contracts";
import {
  type createPlatformDb,
  merchantSalesDocumentCounters,
  merchantSalesDocuments,
} from "@ecs/db";
import { and, desc, eq, sql } from "drizzle-orm";

type PlatformDatabase = ReturnType<typeof createPlatformDb>["db"];

function mapDocument(row: typeof merchantSalesDocuments.$inferSelect): MerchantSalesDocument {
  return {
    contentHash: row.contentHash,
    createdAt: row.createdAt.toISOString(),
    id: row.id,
    kind: row.kind as MerchantSalesDocument["kind"],
    language: row.language as MerchantSalesDocument["language"],
    number: row.number,
    orderId: row.orderId,
    snapshot: row.snapshot as MerchantSalesDocumentSnapshot,
  };
}

export function hashSalesDocumentSnapshot(snapshot: MerchantSalesDocumentSnapshot) {
  return createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
}

export function createMerchantSalesDocumentStore(db: PlatformDatabase) {
  return {
    async issue(input: {
      createdByUserId: string;
      snapshot: MerchantSalesDocumentSnapshot;
      tenantId: string;
    }) {
      return db.transaction(async (tx) => {
        const [counter] = await tx
          .insert(merchantSalesDocumentCounters)
          .values({ nextNumber: 2, tenantId: input.tenantId })
          .onConflictDoUpdate({
            set: { nextNumber: sql`${merchantSalesDocumentCounters.nextNumber} + 1` },
            target: merchantSalesDocumentCounters.tenantId,
          })
          .returning({ nextNumber: merchantSalesDocumentCounters.nextNumber });
        const number = `OP-${String((counter?.nextNumber ?? 2) - 1).padStart(6, "0")}`;
        const [row] = await tx
          .insert(merchantSalesDocuments)
          .values({
            contentHash: hashSalesDocumentSnapshot(input.snapshot),
            createdByUserId: input.createdByUserId,
            kind: input.snapshot.kind,
            language: input.snapshot.language,
            number,
            orderId: input.snapshot.order.id,
            snapshot: input.snapshot,
            tenantId: input.tenantId,
          })
          .returning();
        if (!row) throw new Error("sales_document_create_failed");
        return mapDocument(row);
      });
    },
    async list(input: { orderId: string; tenantId: string }) {
      const rows = await db
        .select()
        .from(merchantSalesDocuments)
        .where(
          and(
            eq(merchantSalesDocuments.tenantId, input.tenantId),
            eq(merchantSalesDocuments.orderId, input.orderId),
          ),
        )
        .orderBy(desc(merchantSalesDocuments.createdAt));
      return rows.map(mapDocument);
    },
    async get(input: { documentId: string; tenantId: string }) {
      const [row] = await db
        .select()
        .from(merchantSalesDocuments)
        .where(
          and(
            eq(merchantSalesDocuments.id, input.documentId),
            eq(merchantSalesDocuments.tenantId, input.tenantId),
          ),
        )
        .limit(1);
      return row ? mapDocument(row) : null;
    },
  };
}
