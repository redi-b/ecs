import type { createPlatformDb } from "@ecs/db";
import {
  storefrontConfigs,
  storefrontTemplates,
  storefrontTemplateVersions,
  tenants,
} from "@ecs/db";
import { and, asc, eq } from "drizzle-orm";

import type { StorefrontTemplateCatalogItem, StorefrontTemplateSelectionResult } from "../app.js";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];

export function createStorefrontTemplateService(db: PlatformDb) {
  return {
    listStorefrontTemplates: async (): Promise<StorefrontTemplateCatalogItem[]> => {
      const rows = await db
        .select({
          id: storefrontTemplates.id,
          slug: storefrontTemplates.slug,
          name: storefrontTemplates.name,
          description: storefrontTemplates.description,
          previewAssetId: storefrontTemplates.previewAssetId,
          tags: storefrontTemplates.tags,
          minimumPlanId: storefrontTemplates.minimumPlanId,
          versionId: storefrontTemplateVersions.id,
          version: storefrontTemplateVersions.version,
          templateKey: storefrontTemplateVersions.templateKey,
          previewData: storefrontTemplateVersions.previewData,
        })
        .from(storefrontTemplateVersions)
        .innerJoin(
          storefrontTemplates,
          eq(storefrontTemplateVersions.templateId, storefrontTemplates.id),
        )
        .where(
          and(
            eq(storefrontTemplates.status, "active"),
            eq(storefrontTemplateVersions.status, "active"),
          ),
        )
        .orderBy(asc(storefrontTemplates.sortOrder), asc(storefrontTemplateVersions.version));

      return rows.map((row) => ({
        id: row.id,
        slug: row.slug,
        name: row.name,
        description: row.description,
        previewAssetId: row.previewAssetId,
        tags: row.tags,
        minimumPlanId: row.minimumPlanId,
        version: {
          id: row.versionId,
          version: row.version,
          templateKey: row.templateKey,
          previewData: row.previewData,
        },
      }));
    },
    selectStorefrontTemplate: async (input: {
      tenantId: string;
      templateKey: string;
      userId: string;
    }): Promise<StorefrontTemplateSelectionResult> => {
      const [tenant] = await db
        .select({
          id: tenants.id,
          planId: tenants.planId,
        })
        .from(tenants)
        .where(eq(tenants.id, input.tenantId))
        .limit(1);

      if (!tenant) {
        return { ok: false, error: "tenant_not_found" };
      }

      const [template] = await db
        .select({
          id: storefrontTemplates.id,
          minimumPlanId: storefrontTemplates.minimumPlanId,
          version: storefrontTemplateVersions.version,
          templateKey: storefrontTemplateVersions.templateKey,
          defaultData: storefrontTemplateVersions.defaultData,
          defaultThemeTokens: storefrontTemplateVersions.defaultThemeTokens,
        })
        .from(storefrontTemplateVersions)
        .innerJoin(
          storefrontTemplates,
          eq(storefrontTemplateVersions.templateId, storefrontTemplates.id),
        )
        .where(
          and(
            eq(storefrontTemplateVersions.templateKey, input.templateKey),
            eq(storefrontTemplates.status, "active"),
            eq(storefrontTemplateVersions.status, "active"),
          ),
        )
        .limit(1);

      if (!template) {
        return { ok: false, error: "template_not_found" };
      }

      if (template.minimumPlanId && tenant.planId !== template.minimumPlanId) {
        return { ok: false, error: "template_plan_unavailable" };
      }

      const [draft] = await db
        .insert(storefrontConfigs)
        .values({
          tenantId: tenant.id,
          draftTemplateId: template.id,
          draftTemplateVersion: template.version,
          draftData: template.defaultData,
          draftThemeTokens: template.defaultThemeTokens,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: storefrontConfigs.tenantId,
          set: {
            draftTemplateId: template.id,
            draftTemplateVersion: template.version,
            draftData: template.defaultData,
            draftThemeTokens: template.defaultThemeTokens,
            updatedAt: new Date(),
          },
        })
        .returning({
          tenantId: storefrontConfigs.tenantId,
          templateId: storefrontConfigs.draftTemplateId,
          templateVersion: storefrontConfigs.draftTemplateVersion,
        });

      if (!draft?.templateId || !draft.templateVersion) {
        return { ok: false, error: "template_not_found" };
      }

      return {
        ok: true,
        draft: {
          tenantId: draft.tenantId,
          templateId: draft.templateId,
          templateVersion: draft.templateVersion,
          templateKey: template.templateKey,
        },
      };
    },
  };
}
