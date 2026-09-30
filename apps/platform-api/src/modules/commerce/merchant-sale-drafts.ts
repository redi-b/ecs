import type {
  MerchantSaleDraft,
  MerchantSaleDraftConflict,
  MerchantSaleDraftContent,
  MerchantSaleDraftSummary,
} from "@ecs/contracts";
import { type createPlatformDb, merchantSaleDrafts } from "@ecs/db";
import { and, count, desc, eq } from "drizzle-orm";

type DraftWriteResult =
  | { ok: true; draft: MerchantSaleDraft }
  | {
      ok: false;
      error:
        | "sale_draft_not_found"
        | "sale_draft_revision_conflict"
        | "sale_draft_validation_unavailable";
      status: 404 | 409 | 503;
    };

export type MerchantSaleDraftStore = {
  archive(input: {
    draftId: string;
    expectedRevision: number;
    tenantId: string;
  }): Promise<
    | { ok: true }
    | { ok: false; error: "sale_draft_not_found"; status: 404 }
    | { ok: false; error: "sale_draft_revision_conflict"; status: 409 }
  >;
  get(input: { draftId: string; tenantId: string }): Promise<MerchantSaleDraft | null>;
  list(input: {
    limit: number;
    offset: number;
    tenantId: string;
  }): Promise<{ count: number; drafts: MerchantSaleDraftSummary[] }>;
  save(input: {
    conflicts: MerchantSaleDraftConflict[];
    content: MerchantSaleDraftContent;
    draftId?: string | undefined;
    expectedRevision?: number | undefined;
    ownerUserId: string;
    tenantId: string;
  }): Promise<DraftWriteResult>;
};

export type ValidateMerchantSaleDraft = (input: {
  content: MerchantSaleDraftContent;
  salesChannelId: string;
  stockLocationId?: string | null | undefined;
}) => Promise<
  | {
      ok: true;
      conflicts: MerchantSaleDraftConflict[];
      content: MerchantSaleDraftContent;
    }
  | { ok: false; error: "sale_draft_validation_unavailable"; status: 503 }
>;

export function createMerchantSaleDraftValidator(input: {
  getProduct: NonNullable<
    import("../../types/platform-catalog-options.js").PlatformCatalogOptions["getMerchantProduct"]
  >;
}): ValidateMerchantSaleDraft {
  return async ({ content, salesChannelId, stockLocationId }) => {
    const productIds = [...new Set(content.items.map((item) => item.productId))];
    const products = await Promise.all(
      productIds.map(async (productId) => ({
        productId,
        result: await input.getProduct({ productId, salesChannelId, stockLocationId }),
      })),
    );
    const conflicts: MerchantSaleDraftConflict[] = [];
    const resolvedItems = new Map<
      MerchantSaleDraftContent["items"][number],
      MerchantSaleDraftContent["items"][number]
    >();
    for (const loaded of products) {
      const matchingItems = content.items.filter((item) => item.productId === loaded.productId);
      if (!loaded.result.ok) {
        if (loaded.result.error !== "product_not_found") {
          return { ok: false, error: "sale_draft_validation_unavailable", status: 503 };
        }
        conflicts.push(
          ...matchingItems.map((item) => ({
            code: "product_removed" as const,
            productId: item.productId,
            variantId: item.variantId,
          })),
        );
        continue;
      }
      for (const item of matchingItems) {
        const variant = loaded.result.product.variants?.find((row) => row.id === item.variantId);
        if (!variant) {
          conflicts.push({
            code: "variant_removed",
            productId: item.productId,
            variantId: item.variantId,
          });
          continue;
        }
        const currentPrice = variant.prices.find(
          (price) => price.currencyCode?.toLowerCase() === "etb",
        )?.amount;
        resolvedItems.set(item, {
          ...item,
          productTitle: loaded.result.product.title ?? item.productTitle ?? null,
          sku: variant.sku ?? item.sku ?? null,
          unitPrice: item.unitPrice ?? currentPrice ?? null,
          variantTitle: variant.title ?? item.variantTitle ?? null,
        });
        if (item.unitPrice != null && currentPrice != null && item.unitPrice !== currentPrice) {
          conflicts.push({
            code: "price_changed",
            currentPrice,
            productId: item.productId,
            variantId: item.variantId,
          });
        }
        const availableQuantity = variant.stock?.availableQuantity;
        if (availableQuantity != null && item.quantity > availableQuantity) {
          conflicts.push({
            availableQuantity,
            code: "insufficient_stock",
            productId: item.productId,
            variantId: item.variantId,
          });
        }
      }
    }
    return {
      ok: true,
      conflicts,
      content: {
        ...content,
        items: content.items.map((item) => resolvedItems.get(item) ?? item),
      },
    };
  };
}

export function createMerchantSaleDraftService(input: {
  store: MerchantSaleDraftStore;
  validate: ValidateMerchantSaleDraft;
}) {
  return {
    archive: input.store.archive,
    get: input.store.get,
    list: input.store.list,
    async save(saveInput: {
      content: MerchantSaleDraftContent;
      draftId?: string | undefined;
      expectedRevision?: number | undefined;
      ownerUserId: string;
      salesChannelId: string;
      stockLocationId?: string | null | undefined;
      tenantId: string;
    }): Promise<DraftWriteResult> {
      const validation = await input.validate({
        content: saveInput.content,
        salesChannelId: saveInput.salesChannelId,
        stockLocationId: saveInput.stockLocationId,
      });
      if (!validation.ok) return validation;
      return input.store.save({
        conflicts: validation.conflicts,
        content: validation.content,
        draftId: saveInput.draftId,
        expectedRevision: saveInput.expectedRevision,
        ownerUserId: saveInput.ownerUserId,
        tenantId: saveInput.tenantId,
      });
    },
  };
}

export function createInMemoryMerchantSaleDraftStore(): MerchantSaleDraftStore {
  const rows = new Map<
    string,
    MerchantSaleDraft & { status: "active" | "deleted"; tenantId: string }
  >();
  let sequence = 0;
  return {
    async archive(input) {
      const row = rows.get(input.draftId);
      if (!row || row.tenantId !== input.tenantId || row.status !== "active") {
        return { ok: false, error: "sale_draft_not_found", status: 404 };
      }
      if (row.revision !== input.expectedRevision) {
        return { ok: false, error: "sale_draft_revision_conflict", status: 409 };
      }
      rows.set(input.draftId, { ...row, status: "deleted", updatedAt: new Date().toISOString() });
      return { ok: true };
    },
    async get(input) {
      const row = rows.get(input.draftId);
      return row?.tenantId === input.tenantId && row.status === "active"
        ? stripMemoryFields(row)
        : null;
    },
    async list(input) {
      const matches = [...rows.values()]
        .filter((row) => row.tenantId === input.tenantId && row.status === "active")
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
      return {
        count: matches.length,
        drafts: matches.slice(input.offset, input.offset + input.limit).map((row) => ({
          createdAt: row.createdAt,
          currentStep: row.currentStep,
          customerLabel: getCustomerLabel(row),
          id: row.id,
          itemCount: row.items.length,
          ownerUserId: row.ownerUserId,
          revision: row.revision,
          updatedAt: row.updatedAt,
        })),
      };
    },
    async save(input) {
      const now = new Date().toISOString();
      if (!input.draftId) {
        sequence += 1;
        const draft = {
          ...input.content,
          conflicts: input.conflicts,
          createdAt: now,
          id: `draft_${sequence}`,
          ownerUserId: input.ownerUserId,
          revision: 1,
          status: "active" as const,
          tenantId: input.tenantId,
          updatedAt: now,
        };
        rows.set(draft.id, draft);
        return { ok: true, draft: stripMemoryFields(draft) };
      }
      const current = rows.get(input.draftId);
      if (!current || current.tenantId !== input.tenantId || current.status !== "active") {
        return { ok: false, error: "sale_draft_not_found", status: 404 };
      }
      if (!input.expectedRevision || current.revision !== input.expectedRevision) {
        return { ok: false, error: "sale_draft_revision_conflict", status: 409 };
      }
      const draft = {
        ...input.content,
        conflicts: input.conflicts,
        createdAt: current.createdAt,
        id: current.id,
        ownerUserId: input.ownerUserId,
        revision: current.revision + 1,
        status: "active" as const,
        tenantId: current.tenantId,
        updatedAt: now,
      };
      rows.set(draft.id, draft);
      return { ok: true, draft: stripMemoryFields(draft) };
    },
  };
}

type PlatformDatabase = ReturnType<typeof createPlatformDb>["db"];

export function createPostgresMerchantSaleDraftStore(db: PlatformDatabase): MerchantSaleDraftStore {
  return {
    async archive(input) {
      const [archived] = await db
        .update(merchantSaleDrafts)
        .set({ deletedAt: new Date(), status: "deleted", updatedAt: new Date() })
        .where(
          and(
            eq(merchantSaleDrafts.id, input.draftId),
            eq(merchantSaleDrafts.tenantId, input.tenantId),
            eq(merchantSaleDrafts.status, "active"),
            eq(merchantSaleDrafts.revision, input.expectedRevision),
          ),
        )
        .returning({ id: merchantSaleDrafts.id });
      if (archived) return { ok: true };
      const existing = await this.get({ draftId: input.draftId, tenantId: input.tenantId });
      return existing
        ? { ok: false, error: "sale_draft_revision_conflict", status: 409 }
        : { ok: false, error: "sale_draft_not_found", status: 404 };
    },
    async get(input) {
      const [row] = await db
        .select()
        .from(merchantSaleDrafts)
        .where(
          and(
            eq(merchantSaleDrafts.id, input.draftId),
            eq(merchantSaleDrafts.tenantId, input.tenantId),
            eq(merchantSaleDrafts.status, "active"),
          ),
        )
        .limit(1);
      return row ? mapDraft(row) : null;
    },
    async list(input) {
      const where = and(
        eq(merchantSaleDrafts.tenantId, input.tenantId),
        eq(merchantSaleDrafts.status, "active"),
      );
      const [rows, totals] = await Promise.all([
        db
          .select()
          .from(merchantSaleDrafts)
          .where(where)
          .orderBy(desc(merchantSaleDrafts.updatedAt))
          .limit(input.limit)
          .offset(input.offset),
        db.select({ value: count() }).from(merchantSaleDrafts).where(where),
      ]);
      return {
        count: totals[0]?.value ?? 0,
        drafts: rows.map((row) => ({
          createdAt: row.createdAt.toISOString(),
          currentStep: row.currentStep,
          customerLabel: row.customerLabel,
          id: row.id,
          itemCount: row.itemCount,
          ownerUserId: row.ownerUserId,
          revision: row.revision,
          updatedAt: row.updatedAt.toISOString(),
        })),
      };
    },
    async save(input) {
      const values = {
        conflicts: input.conflicts,
        content: input.content,
        currentStep: input.content.currentStep,
        customerLabel: getCustomerLabel(input.content),
        itemCount: input.content.items.length,
        ownerUserId: input.ownerUserId,
        updatedAt: new Date(),
      };
      if (!input.draftId) {
        const [created] = await db
          .insert(merchantSaleDrafts)
          .values({ ...values, tenantId: input.tenantId })
          .returning();
        if (!created) throw new Error("Sale draft insert returned no row.");
        return { ok: true, draft: mapDraft(created) };
      }
      if (!input.expectedRevision) {
        return { ok: false, error: "sale_draft_revision_conflict", status: 409 };
      }
      const [updated] = await db
        .update(merchantSaleDrafts)
        .set({ ...values, revision: input.expectedRevision + 1 })
        .where(
          and(
            eq(merchantSaleDrafts.id, input.draftId),
            eq(merchantSaleDrafts.tenantId, input.tenantId),
            eq(merchantSaleDrafts.status, "active"),
            eq(merchantSaleDrafts.revision, input.expectedRevision),
          ),
        )
        .returning();
      if (updated) return { ok: true, draft: mapDraft(updated) };
      const existing = await this.get({ draftId: input.draftId, tenantId: input.tenantId });
      return existing
        ? { ok: false, error: "sale_draft_revision_conflict", status: 409 }
        : { ok: false, error: "sale_draft_not_found", status: 404 };
    },
  };
}

function mapDraft(row: typeof merchantSaleDrafts.$inferSelect): MerchantSaleDraft {
  return {
    ...(row.content as MerchantSaleDraftContent),
    conflicts: row.conflicts as MerchantSaleDraftConflict[],
    createdAt: row.createdAt.toISOString(),
    id: row.id,
    ownerUserId: row.ownerUserId,
    revision: row.revision,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function getCustomerLabel(content: MerchantSaleDraftContent) {
  const name = [content.customer.firstName, content.customer.lastName].filter(Boolean).join(" ");
  return name || content.customer.phone || content.customer.email || null;
}

function stripMemoryFields(
  draft: MerchantSaleDraft & { status: "active" | "deleted"; tenantId: string },
): MerchantSaleDraft {
  const { status: _status, tenantId: _tenantId, ...result } = draft;
  return result;
}
