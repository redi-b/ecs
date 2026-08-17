import type { createPlatformDb } from "@ecs/db";
import {
  auditLogs,
  storefrontTemplates as dbStorefrontTemplates,
  storefrontConfigs,
  storefrontRevisions,
  storefrontTemplateDrafts,
  storefrontTemplateVersions,
  tenants,
} from "@ecs/db";
import {
  storefrontTemplates as templateRegistry,
} from "@ecs/storefront-templates";
import { isDeepStrictEqual } from "node:util";
import { and, asc, eq } from "drizzle-orm";
import type {
  PublishedStorefrontConfigResult,
  StorefrontDraftResult,
  StorefrontDraftUpdateResult,
  StorefrontPublishResult,
  StorefrontTemplateCatalogItem,
  StorefrontTemplateSelectionResult,
  StorefrontUnpublishResult,
} from "../../types/index.js";
import { purgeStorefrontTenantCache } from "./cache-purge.js";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];

type StorefrontTemplateDefinition = (typeof templateRegistry)[number];

function getTemplate(templateKey: string): StorefrontTemplateDefinition | undefined {
  return templateRegistry.find((item) => item.templateKey === templateKey);
}

export function normalizeStorefrontDraftPayload(input: {
  data: unknown;
  templateKey: string;
  themeTokens: unknown;
}) {
  const template = getTemplate(input.templateKey);

  if (!template) {
    return undefined;
  }

  const data = mergeStorefrontTemplateDefaults(template.defaultData, input.data);
  const themeTokens = mergeStorefrontTemplateDefaults(
    template.defaultThemeTokens,
    input.themeTokens,
  );
  const parsedData = template.schema.safeParse(data);
  const parsedThemeTokens = template.themeSchema.safeParse(themeTokens);

  if (!parsedData.success || !parsedThemeTokens.success) {
    return undefined;
  }

  return {
    data: parsedData.data,
    themeTokens: parsedThemeTokens.data,
  };
}

export function mergeStorefrontTemplateDefaults(defaultValue: unknown, value: unknown): unknown {
  if (Array.isArray(defaultValue)) {
    if (!Array.isArray(value)) {
      return cloneJson(defaultValue);
    }

    return value.map((item, index) =>
      mergeStorefrontTemplateDefaults(defaultValue[index] ?? {}, item),
    );
  }

  if (isPlainObject(defaultValue)) {
    const valueRecord = isPlainObject(value) ? value : {};
    const merged: Record<string, unknown> = {};
    const keys = new Set([...Object.keys(defaultValue), ...Object.keys(valueRecord)]);

    for (const key of keys) {
      merged[key] = mergeStorefrontTemplateDefaults(defaultValue[key], valueRecord[key]);
    }

    return merged;
  }

  if (
    value === undefined ||
    value === null ||
    (value === "" && defaultValue !== undefined && defaultValue !== null)
  ) {
    return cloneJson(defaultValue);
  }

  return value;
}

export function resolveTemplateDraft(input: {
  defaultData: unknown;
  defaultThemeTokens: unknown;
  mode: "clean" | "resume";
  saved?: { data: unknown; themeTokens: unknown } | null | undefined;
}) {
  if (input.mode === "resume" && input.saved) {
    return { data: input.saved.data, source: "saved" as const, themeTokens: input.saved.themeTokens };
  }
  return { data: input.defaultData, source: "clean" as const, themeTokens: input.defaultThemeTokens };
}

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
        publishedRevisionId: storefrontConfigs.publishedRevisionId,
        publishedAt: storefrontConfigs.publishedAt,
        publishedTemplateKey: storefrontRevisions.templateKey,
        publishedData: storefrontRevisions.data,
        publishedThemeTokens: storefrontRevisions.themeTokens,
      })
      .from(storefrontConfigs)
      .innerJoin(
        storefrontTemplateVersions,
        and(
          eq(storefrontTemplateVersions.templateId, storefrontConfigs.draftTemplateId),
          eq(storefrontTemplateVersions.version, storefrontConfigs.draftTemplateVersion),
        ),
      )
      .leftJoin(
        storefrontRevisions,
        eq(storefrontRevisions.id, storefrontConfigs.publishedRevisionId),
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
        published:
          draft.publishedRevisionId && draft.publishedAt
            ? {
                revisionId: draft.publishedRevisionId,
                publishedAt: draft.publishedAt.toISOString(),
                templateKey: draft.publishedTemplateKey,
                data: draft.publishedData,
                themeTokens: draft.publishedThemeTokens,
              }
            : null,
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
          id: dbStorefrontTemplates.id,
          slug: dbStorefrontTemplates.slug,
          name: dbStorefrontTemplates.name,
          description: dbStorefrontTemplates.description,
          previewAssetId: dbStorefrontTemplates.previewAssetId,
          tags: dbStorefrontTemplates.tags,
          minimumPlanId: dbStorefrontTemplates.minimumPlanId,
          versionId: storefrontTemplateVersions.id,
          version: storefrontTemplateVersions.version,
          templateKey: storefrontTemplateVersions.templateKey,
          previewData: storefrontTemplateVersions.previewData,
        })
        .from(storefrontTemplateVersions)
        .innerJoin(
          dbStorefrontTemplates,
          eq(storefrontTemplateVersions.templateId, dbStorefrontTemplates.id),
        )
        .where(
          and(
            eq(dbStorefrontTemplates.status, "active"),
            eq(storefrontTemplateVersions.status, "active"),
          ),
        )
        .orderBy(asc(dbStorefrontTemplates.sortOrder), asc(storefrontTemplateVersions.version));

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
      const currentDraft = await getStorefrontDraft({ tenantId: input.tenantId });

      if (!currentDraft.ok) {
        return currentDraft;
      }

      const normalizedDraft = normalizeStorefrontDraftPayload({
        data: input.data,
        templateKey: currentDraft.draft.templateKey,
        themeTokens: input.themeTokens,
      });

      if (!normalizedDraft) {
        return {
          ok: false,
          error: "invalid_storefront_draft",
        };
      }

      const updated = await db.transaction(async (transaction) => {
        const [row] = await transaction
          .update(storefrontConfigs)
          .set({
            draftData: normalizedDraft.data,
            draftThemeTokens: normalizedDraft.themeTokens,
            updatedAt: new Date(),
          })
          .where(eq(storefrontConfigs.tenantId, input.tenantId))
          .returning({
            tenantId: storefrontConfigs.tenantId,
          });

        const [version] = await transaction
          .select({ id: storefrontTemplateVersions.id })
          .from(storefrontTemplateVersions)
          .where(eq(storefrontTemplateVersions.templateKey, currentDraft.draft.templateKey))
          .limit(1);

        if (row && version) {
          await transaction
            .insert(storefrontTemplateDrafts)
            .values({
              tenantId: input.tenantId,
              templateVersionId: version.id,
              data: normalizedDraft.data,
              themeTokens: normalizedDraft.themeTokens,
              updatedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: [storefrontTemplateDrafts.tenantId, storefrontTemplateDrafts.templateVersionId],
              set: {
                data: normalizedDraft.data,
                themeTokens: normalizedDraft.themeTokens,
                updatedAt: new Date(),
              },
            });
        }

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

        const normalizedDraft = normalizeStorefrontDraftPayload({
          data: draft.data,
          templateKey: draft.templateKey,
          themeTokens: draft.themeTokens,
        });

        if (!normalizedDraft) {
          return "invalid";
        }

        const [revision] = await transaction
          .insert(storefrontRevisions)
          .values({
            tenantId: input.tenantId,
            templateId: draft.templateId,
            templateVersion: draft.templateVersion,
            templateKey: draft.templateKey,
            data: normalizedDraft.data,
            themeTokens: normalizedDraft.themeTokens,
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
            draftData: normalizedDraft.data,
            draftThemeTokens: normalizedDraft.themeTokens,
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

      if (published === "invalid") {
        return {
          ok: false,
          error: "invalid_storefront_draft",
        };
      }

      // Drop cached public HTML for this tenant so the new revision is visible promptly.
      await purgeStorefrontTenantCache({ tenantId: published.tenantId });

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
    /**
     * Take the live shop offline without deleting the draft.
     * Clears publishedRevisionId so host resolution returns shop_unpublished.
     */
    unpublishStorefront: async (input: {
      tenantId: string;
      userId: string;
    }): Promise<StorefrontUnpublishResult> => {
      const [existing] = await db
        .select({
          tenantId: storefrontConfigs.tenantId,
          publishedRevisionId: storefrontConfigs.publishedRevisionId,
        })
        .from(storefrontConfigs)
        .where(eq(storefrontConfigs.tenantId, input.tenantId))
        .limit(1);

      if (!existing) {
        return {
          ok: false,
          error: "storefront_draft_not_found",
        };
      }

      // Idempotent: already paused is still success.
      if (!existing.publishedRevisionId) {
        return {
          ok: true,
          storefront: {
            tenantId: existing.tenantId,
            isPublished: false,
          },
        };
      }

      await db.transaction(async (transaction) => {
        await transaction
          .update(storefrontConfigs)
          .set({
            publishedRevisionId: null,
            publishedAt: null,
            updatedAt: new Date(),
          })
          .where(eq(storefrontConfigs.tenantId, input.tenantId));

        await transaction.insert(auditLogs).values({
          actorUserId: input.userId,
          tenantId: input.tenantId,
          action: "storefront.unpublished",
          targetType: "storefront_config",
          targetId: input.tenantId,
          metadata: {
            previousPublishedRevisionId: existing.publishedRevisionId,
          },
        });
      });

      await purgeStorefrontTenantCache({ tenantId: existing.tenantId });

      return {
        ok: true,
        storefront: {
          tenantId: existing.tenantId,
          isPublished: false,
        },
      };
    },
    selectStorefrontTemplate: async (input: {
      tenantId: string;
      templateKey: string;
      mode?: "clean" | "resume";
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
          id: dbStorefrontTemplates.id,
          minimumPlanId: dbStorefrontTemplates.minimumPlanId,
          version: storefrontTemplateVersions.version,
          versionId: storefrontTemplateVersions.id,
          templateKey: storefrontTemplateVersions.templateKey,
          defaultData: storefrontTemplateVersions.defaultData,
          defaultThemeTokens: storefrontTemplateVersions.defaultThemeTokens,
        })
        .from(storefrontTemplateVersions)
        .innerJoin(
          dbStorefrontTemplates,
          eq(storefrontTemplateVersions.templateId, dbStorefrontTemplates.id),
        )
        .where(
          and(
            eq(storefrontTemplateVersions.templateKey, input.templateKey),
            eq(dbStorefrontTemplates.status, "active"),
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

      const selected = await db.transaction(async (transaction) => {
        const [current] = await transaction
          .select({
            data: storefrontConfigs.draftData,
            publishedRevisionId: storefrontConfigs.publishedRevisionId,
            templateId: storefrontConfigs.draftTemplateId,
            templateVersion: storefrontConfigs.draftTemplateVersion,
            themeTokens: storefrontConfigs.draftThemeTokens,
          })
          .from(storefrontConfigs)
          .where(eq(storefrontConfigs.tenantId, tenant.id))
          .limit(1);

        if (current?.templateId && current.templateVersion) {
          const [currentVersion] = await transaction
            .select({ id: storefrontTemplateVersions.id })
            .from(storefrontTemplateVersions)
            .where(and(
              eq(storefrontTemplateVersions.templateId, current.templateId),
              eq(storefrontTemplateVersions.version, current.templateVersion),
            ))
            .limit(1);
          if (currentVersion) {
            await transaction
              .insert(storefrontTemplateDrafts)
              .values({
                tenantId: tenant.id,
                templateVersionId: currentVersion.id,
                data: current.data,
                themeTokens: current.themeTokens,
                updatedAt: new Date(),
              })
              .onConflictDoUpdate({
                target: [storefrontTemplateDrafts.tenantId, storefrontTemplateDrafts.templateVersionId],
                set: { data: current.data, themeTokens: current.themeTokens, updatedAt: new Date() },
              });
          }
        }

        const [saved] = await transaction
          .select({ data: storefrontTemplateDrafts.data, themeTokens: storefrontTemplateDrafts.themeTokens })
          .from(storefrontTemplateDrafts)
          .where(and(
            eq(storefrontTemplateDrafts.tenantId, tenant.id),
            eq(storefrontTemplateDrafts.templateVersionId, template.versionId),
          ))
          .limit(1);
        const next = resolveTemplateDraft({
          defaultData: template.defaultData,
          defaultThemeTokens: template.defaultThemeTokens,
          mode: input.mode ?? "resume",
          saved,
        });
        const [published] = current?.publishedRevisionId
          ? await transaction
              .select({
                data: storefrontRevisions.data,
                templateKey: storefrontRevisions.templateKey,
                themeTokens: storefrontRevisions.themeTokens,
              })
              .from(storefrontRevisions)
              .where(eq(storefrontRevisions.id, current.publishedRevisionId))
              .limit(1)
          : [];
        const hasUnpublishedChanges = Boolean(
          published &&
            (published.templateKey !== template.templateKey ||
              !isDeepStrictEqual(published.data, next.data) ||
              !isDeepStrictEqual(published.themeTokens, next.themeTokens)),
        );

        const [draft] = await transaction
          .insert(storefrontConfigs)
          .values({
            tenantId: tenant.id,
            draftTemplateId: template.id,
            draftTemplateVersion: template.version,
            draftData: next.data,
            draftThemeTokens: next.themeTokens,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: storefrontConfigs.tenantId,
            set: {
              draftTemplateId: template.id,
              draftTemplateVersion: template.version,
              draftData: next.data,
              draftThemeTokens: next.themeTokens,
              updatedAt: new Date(),
            },
          })
          .returning({
            tenantId: storefrontConfigs.tenantId,
            templateId: storefrontConfigs.draftTemplateId,
            templateVersion: storefrontConfigs.draftTemplateVersion,
          });
        return { draft, hasUnpublishedChanges, source: next.source };
      });

      const draft = selected.draft;

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
          source: selected.source,
          hasUnpublishedChanges: selected.hasUnpublishedChanges,
        },
      };
    },
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cloneJson(value: unknown) {
  if (value === undefined) {
    return undefined;
  }

  return JSON.parse(JSON.stringify(value)) as unknown;
}
