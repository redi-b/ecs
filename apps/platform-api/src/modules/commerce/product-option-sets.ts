import type { createPlatformDb, ProductOptionSetValue } from "@ecs/db";
import { productOptionSets } from "@ecs/db";
import { and, asc, eq, ilike, ne } from "drizzle-orm";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];

export type ProductOptionSet = {
  id: string;
  title: string;
  values: ProductOptionSetValue[];
  createdAt: string;
  updatedAt: string;
};

function mapRow(row: typeof productOptionSets.$inferSelect): ProductOptionSet {
  return {
    id: row.id,
    title: row.title,
    values: row.values,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function normalizeProductOptionSetValues(values: ProductOptionSetValue[]) {
  const seen = new Set<string>();
  return values.flatMap((value) => {
    const label = value.label.trim();
    const key = label.toLocaleLowerCase();
    if (!label || seen.has(key)) return [];
    seen.add(key);
    return [
      {
        label,
        ...(value.swatch?.kind === "color" && /^#[0-9a-f]{6}$/i.test(value.swatch.value)
          ? { swatch: { kind: "color" as const, value: value.swatch.value.toLowerCase() } }
          : {}),
      },
    ];
  });
}

export function createProductOptionSetService(db: PlatformDb) {
  return {
    async list(input: { tenantId: string }) {
      const rows = await db
        .select()
        .from(productOptionSets)
        .where(eq(productOptionSets.tenantId, input.tenantId))
        .orderBy(asc(productOptionSets.title));
      return { ok: true as const, optionSets: rows.map(mapRow) };
    },

    async create(input: { tenantId: string; title: string; values: ProductOptionSetValue[] }) {
      const title = input.title.trim();
      const values = normalizeProductOptionSetValues(input.values);
      if (!title || values.length === 0) {
        return { ok: false as const, error: "invalid_product_option_set", status: 400 as const };
      }
      const [duplicate] = await db
        .select({ id: productOptionSets.id })
        .from(productOptionSets)
        .where(
          and(
            eq(productOptionSets.tenantId, input.tenantId),
            ilike(productOptionSets.title, title),
          ),
        )
        .limit(1);
      if (duplicate) {
        return {
          ok: false as const,
          error: "product_option_set_title_taken",
          status: 409 as const,
        };
      }
      try {
        const [row] = await db
          .insert(productOptionSets)
          .values({ tenantId: input.tenantId, title, values })
          .returning();
        if (!row) {
          return {
            ok: false as const,
            error: "product_option_set_create_failed",
            status: 500 as const,
          };
        }
        return { ok: true as const, optionSet: mapRow(row) };
      } catch {
        return {
          ok: false as const,
          error: "product_option_set_title_taken",
          status: 409 as const,
        };
      }
    },

    async update(input: {
      tenantId: string;
      optionSetId: string;
      title: string;
      values: ProductOptionSetValue[];
    }) {
      const title = input.title.trim();
      const values = normalizeProductOptionSetValues(input.values);
      if (!title || values.length === 0) {
        return { ok: false as const, error: "invalid_product_option_set", status: 400 as const };
      }
      const [duplicate] = await db
        .select({ id: productOptionSets.id })
        .from(productOptionSets)
        .where(
          and(
            eq(productOptionSets.tenantId, input.tenantId),
            ilike(productOptionSets.title, title),
            ne(productOptionSets.id, input.optionSetId),
          ),
        )
        .limit(1);
      if (duplicate) {
        return {
          ok: false as const,
          error: "product_option_set_title_taken",
          status: 409 as const,
        };
      }
      try {
        const [row] = await db
          .update(productOptionSets)
          .set({ title, values, updatedAt: new Date() })
          .where(
            and(
              eq(productOptionSets.id, input.optionSetId),
              eq(productOptionSets.tenantId, input.tenantId),
            ),
          )
          .returning();
        if (!row) {
          return {
            ok: false as const,
            error: "product_option_set_not_found",
            status: 404 as const,
          };
        }
        return { ok: true as const, optionSet: mapRow(row) };
      } catch {
        return {
          ok: false as const,
          error: "product_option_set_title_taken",
          status: 409 as const,
        };
      }
    },

    async remove(input: { tenantId: string; optionSetId: string }) {
      const [row] = await db
        .delete(productOptionSets)
        .where(
          and(
            eq(productOptionSets.id, input.optionSetId),
            eq(productOptionSets.tenantId, input.tenantId),
          ),
        )
        .returning({ id: productOptionSets.id });
      return row
        ? { ok: true as const }
        : { ok: false as const, error: "product_option_set_not_found", status: 404 as const };
    },
  };
}
