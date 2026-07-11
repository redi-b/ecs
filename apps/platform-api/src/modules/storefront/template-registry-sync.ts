import type { createPlatformDb } from "@ecs/db";
import { storefrontTemplates as storefrontTemplateRows, storefrontTemplateVersions } from "@ecs/db";
import { storefrontTemplates } from "@ecs/storefront-templates";
import { z } from "zod";

type PlatformDatabase = ReturnType<typeof createPlatformDb>["db"];

export async function syncStorefrontTemplateRegistry(db: PlatformDatabase) {
  for (const [sortOrder, template] of storefrontTemplates.entries()) {
    const [templateRow] = await db
      .insert(storefrontTemplateRows)
      .values({
        id: template.id,
        slug: template.slug,
        name: template.name,
        description: template.description,
        status: "active",
        tags: ["default", "built-in"],
        sortOrder,
      })
      .onConflictDoUpdate({
        target: storefrontTemplateRows.slug,
        set: {
          name: template.name,
          description: template.description,
          status: "active",
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
        status: "active",
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
          status: "active",
        },
      });
  }

  return storefrontTemplates.length;
}
