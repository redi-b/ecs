import type { createPlatformDb } from "@ecs/db";
import {
  auditLogs,
  storefrontConfigs,
  storefrontRevisions,
  storefrontTemplates,
  storefrontTemplateVersions,
  tenants,
} from "@ecs/db";
import { and, asc, eq } from "drizzle-orm";
import type {
  PublishedStorefrontConfigResult,
  StorefrontDraftResult,
  StorefrontDraftUpdateResult,
  StorefrontPublishResult,
  StorefrontTemplateCatalogItem,
  StorefrontTemplateSelectionResult,
} from "../app.js";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];

export function createStorefrontTemplateService(db: PlatformDb) {
  async function getStorefrontDraft(input: { tenantId: string }): Promise<StorefrontDraftResult> {
    const [draft] = await db
      .select({
        tenantId: storefrontConfigs.tenantId,
        templateId: storefrontConfigs.draftTemplateId,
        templateVersion: storefrontConfigs.draftTemplateVersion,
        templateKey: storefrontTemplateVersions.templateKey,
        data: storefrontConfigs.draftData,
        themeTokens: storefrontConfigs.draftThemeTokens,
        updatedAt: storefrontConfigs.updatedAt,
      })
      .from(storefrontConfigs)
      .innerJoin(
        storefrontTemplateVersions,
        and(
          eq(storefrontTemplateVersions.templateId, storefrontConfigs.draftTemplateId),
          eq(storefrontTemplateVersions.version, storefrontConfigs.draftTemplateVersion),
        ),
      )
      .where(eq(storefrontConfigs.tenantId, input.tenantId))
      .limit(1);

    if (!draft?.templateId || !draft.templateVersion) {
      return {
        ok: false,
        error: "storefront_draft_not_found",
      };
    }

    return {
      ok: true,
      draft: {
        tenantId: draft.tenantId,
        templateId: draft.templateId,
        templateVersion: draft.templateVersion,
        templateKey: draft.templateKey,
        data: draft.data,
        themeTokens: draft.themeTokens,
        updatedAt: draft.updatedAt.toISOString(),
      },
    };
  }

  return {
    getPublishedStorefrontConfig: async (input: {
      publishedRevisionId: string;
      tenantId: string;
    }): Promise<PublishedStorefrontConfigResult> => {
      const [revision] = await db
        .select({
          publishedRevisionId: storefrontRevisions.id,
          templateId: storefrontRevisions.templateId,
          templateVersion: storefrontRevisions.templateVersion,
          templateKey: storefrontRevisions.templateKey,
          data: storefrontRevisions.data,
          themeTokens: storefrontRevisions.themeTokens,
          publishedAt: storefrontRevisions.publishedAt,
        })
        .from(storefrontRevisions)
        .where(
          and(
            eq(storefrontRevisions.id, input.publishedRevisionId),
            eq(storefrontRevisions.tenantId, input.tenantId),
          ),
        )
        .limit(1);

      if (!revision) {
        return { ok: false, error: "published_revision_not_found" };
      }

      return {
        ok: true,
        config: {
          publishedRevisionId: revision.publishedRevisionId,
          templateId: revision.templateId,
          templateVersion: revision.templateVersion,
          templateKey: revision.templateKey,
          data: revision.data,
          themeTokens: revision.themeTokens,
          publishedAt: revision.publishedAt.toISOString(),
        },
      };
    },
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
    getStorefrontDraft,
    updateStorefrontDraft: async (input: {
      data: unknown;
      tenantId: string;
      themeTokens: unknown;
      userId: string;
    }): Promise<StorefrontDraftUpdateResult> => {
      const updated = await db.transaction(async (transaction) => {
        const [row] = await transaction
          .update(storefrontConfigs)
          .set({
            draftData: input.data,
            draftThemeTokens: input.themeTokens,
            updatedAt: new Date(),
          })
          .where(eq(storefrontConfigs.tenantId, input.tenantId))
          .returning({
            tenantId: storefrontConfigs.tenantId,
          });

        if (!row) {
          return false;
        }

        await transaction.insert(auditLogs).values({
          actorUserId: input.userId,
          tenantId: input.tenantId,
          action: "storefront.draft_updated",
          targetType: "storefront_config",
          targetId: input.tenantId,
          metadata: {},
        });

        return true;
      });

      if (!updated) {
        return {
          ok: false,
          error: "storefront_draft_not_found",
        };
      }

      return getStorefrontDraft({ tenantId: input.tenantId });
    },
    publishStorefrontDraft: async (input: {
      tenantId: string;
      userId: string;
    }): Promise<StorefrontPublishResult> => {
      const published = await db.transaction(async (transaction) => {
        const [draft] = await transaction
          .select({
            tenantId: storefrontConfigs.tenantId,
            templateId: storefrontConfigs.draftTemplateId,
            templateVersion: storefrontConfigs.draftTemplateVersion,
            templateKey: storefrontTemplateVersions.templateKey,
            data: storefrontConfigs.draftData,
            themeTokens: storefrontConfigs.draftThemeTokens,
          })
          .from(storefrontConfigs)
          .innerJoin(
            storefrontTemplateVersions,
            and(
              eq(storefrontTemplateVersions.templateId, storefrontConfigs.draftTemplateId),
              eq(storefrontTemplateVersions.version, storefrontConfigs.draftTemplateVersion),
            ),
          )
          .where(eq(storefrontConfigs.tenantId, input.tenantId))
          .limit(1);

        if (!draft?.templateId || !draft.templateVersion) {
          return null;
        }

        const [revision] = await transaction
          .insert(storefrontRevisions)
          .values({
            tenantId: input.tenantId,
            templateId: draft.templateId,
            templateVersion: draft.templateVersion,
            templateKey: draft.templateKey,
            data: draft.data,
            themeTokens: draft.themeTokens,
            publishedByUserId: input.userId,
          })
          .returning({
            id: storefrontRevisions.id,
            tenantId: storefrontRevisions.tenantId,
            templateId: storefrontRevisions.templateId,
            templateVersion: storefrontRevisions.templateVersion,
            templateKey: storefrontRevisions.templateKey,
            publishedAt: storefrontRevisions.publishedAt,
          });

        if (!revision) {
          throw new Error("Storefront revision insert returned no rows.");
        }

        await transaction
          .update(storefrontConfigs)
          .set({
            publishedRevisionId: revision.id,
            publishedAt: revision.publishedAt,
            updatedAt: new Date(),
          })
          .where(eq(storefrontConfigs.tenantId, input.tenantId));

        await transaction.insert(auditLogs).values({
          actorUserId: input.userId,
          tenantId: input.tenantId,
          action: "storefront.published",
          targetType: "storefront_revision",
          targetId: revision.id,
          metadata: {
            templateKey: revision.templateKey,
          },
        });

        return revision;
      });

      if (!published) {
        return {
          ok: false,
          error: "storefront_draft_not_found",
        };
      }

      return {
        ok: true,
        storefront: {
          tenantId: published.tenantId,
          publishedRevisionId: published.id,
          templateId: published.templateId,
          templateVersion: published.templateVersion,
          templateKey: published.templateKey,
          publishedAt: published.publishedAt.toISOString(),
        },
      };
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
