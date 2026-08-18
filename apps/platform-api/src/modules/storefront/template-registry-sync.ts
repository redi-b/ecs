import type { createPlatformDb } from "@ecs/db";
import { storefrontTemplates as storefrontTemplateRows, storefrontTemplateVersions } from "@ecs/db";
import { storefrontTemplates } from "@ecs/storefront-templates";
import { inArray } from "drizzle-orm";
import { z } from "zod";

type PlatformDatabase = ReturnType<typeof createPlatformDb>["db"];

export async function syncStorefrontTemplateRegistry(db: PlatformDatabase) {
  for (const [sortOrder, template] of storefrontTemplates.entries()) {
    const status = template.availability === "selectable" ? "active" : "deprecated";
    const [templateRow] = await db
      .insert(storefrontTemplateRows)
      .values({
        id: template.id,
        slug: template.slug,
        name: template.name,
        description: template.description,
        status,
        tags: ["default", "built-in"],
        sortOrder,
      })
      .onConflictDoUpdate({
        target: storefrontTemplateRows.slug,
        set: {
          name: template.name,
          description: template.description,
          status,
          tags: ["default", "built-in"],
          sortOrder,
          updatedAt: new Date(),
        },
      })
      .returning({ id: storefrontTemplateRows.id });

    if (!templateRow) {
      throw new Error(`Failed to synchronize storefront template ${template.templateKey}.`);
    }

    await db
      .insert(storefrontTemplateVersions)
      .values({
        id: template.versionId,
        templateId: templateRow.id,
        version: template.version,
        templateKey: template.templateKey,
        schema: z.toJSONSchema(template.schema),
        defaultData: template.defaultData,
        defaultThemeTokens: template.defaultThemeTokens,
        previewData: template.defaultData,
        componentRegistryVersion: template.componentRegistryVersion,
        sourceHash: template.sourceHash,
        status,
      })
      .onConflictDoUpdate({
        target: storefrontTemplateVersions.templateKey,
        set: {
          templateId: templateRow.id,
          version: template.version,
          schema: z.toJSONSchema(template.schema),
          defaultData: template.defaultData,
          defaultThemeTokens: template.defaultThemeTokens,
          previewData: template.defaultData,
          componentRegistryVersion: template.componentRegistryVersion,
          sourceHash: template.sourceHash,
          status,
        },
      });
  }

  const registeredTemplateIds = new Set<string>(
    storefrontTemplates.map((template) => template.id),
  );
  const builtInRows = await db
    .select({ id: storefrontTemplateRows.id, tags: storefrontTemplateRows.tags })
    .from(storefrontTemplateRows);
  const removedBuiltInIds = builtInRows
    .filter(
      (row) =>
        Array.isArray(row.tags) &&
        row.tags.includes("built-in") &&
        !registeredTemplateIds.has(row.id),
    )
    .map((row) => row.id);

  if (removedBuiltInIds.length > 0) {
    await db
      .update(storefrontTemplateVersions)
      .set({ status: "disabled" })
      .where(inArray(storefrontTemplateVersions.templateId, removedBuiltInIds));
    await db
      .update(storefrontTemplateRows)
      .set({ status: "disabled", updatedAt: new Date() })
      .where(inArray(storefrontTemplateRows.id, removedBuiltInIds));
  }

  return storefrontTemplates.length;
}
