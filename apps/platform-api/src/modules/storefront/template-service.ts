import { isDeepStrictEqual } from "node:util";
import { createHash } from "node:crypto";
import type { createPlatformDb } from "@ecs/db";
import {
  platformAssets,
  auditLogs,
  storefrontTemplates as dbStorefrontTemplates,
  storefrontConfigs,
  storefrontRevisions,
  storefrontTemplateDrafts,
  storefrontTemplateVersions,
  tenants,
  tenantOnboarding,
} from "@ecs/db";
import {
  getStorefrontLocalizationManifest,
  storefrontTemplates as templateRegistry,
} from "@ecs/storefront-templates";
import {
  defaultStorefrontLanguageSettings,
  emptyStorefrontLocalizedContent,
  storefrontLanguageSettingsSchema,
  storefrontLocalizedContentSchema,
  type StorefrontLanguageSettings,
  type StorefrontLocalizedContent,
} from "@ecs/contracts";
import { and, asc, eq } from "drizzle-orm";
import type {
  PublishedStorefrontConfigResult,
  StorefrontDraftResult,
  StorefrontDraftUpdateResult,
  StorefrontPublishResult,
  StorefrontSeoSettings,
  StorefrontSeoSettingsResult,
  StorefrontTemplateCatalogItem,
  StorefrontTemplateSelectionResult,
  StorefrontUnpublishResult,
} from "../../types/index.js";
import { purgeStorefrontTenantCache } from "./cache-purge.js";
import { getDefaultTemplateDemoUrl } from "./template-demo-url.js";
import { applyShopDetails } from "./shop-details.js";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];

type StorefrontTemplateDefinition = (typeof templateRegistry)[number];

export type StorefrontDraftTemplateDefinition = {
  defaultData: unknown;
  defaultThemeTokens: unknown;
  schema: { safeParse(value: unknown): { success: boolean; data?: unknown } };
  themeSchema: { safeParse(value: unknown): { success: boolean; data?: unknown } };
};

const EMPTY_SEO: StorefrontSeoSettings = {
  title: null,
  description: null,
  socialImageUrl: null,
};

export function normalizeStorefrontSeoSettings(value: unknown): StorefrontSeoSettings {
  if (!isPlainObject(value)) return { ...EMPTY_SEO };
  return {
    title: normalizeNullableText(value.title, 70),
    description: normalizeNullableText(value.description, 160),
    socialImageUrl: normalizeNullableText(value.socialImageUrl, 2_000),
  };
}

function normalizeNullableText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized && normalized.length <= maxLength ? normalized : null;
}

export function isTrustedStorefrontSocialImage(
  value: string | null,
  publicBase: string | undefined,
) {
  if (!value) return true;
  const base = publicBase?.trim();
  if (!base) return false;
  try {
    const candidate = new URL(value);
    const trusted = new URL(base);
    const trustedPath = trusted.pathname.replace(/\/$/, "");
    return (
      candidate.protocol === trusted.protocol &&
      candidate.origin === trusted.origin &&
      (candidate.pathname === trustedPath || candidate.pathname.startsWith(`${trustedPath}/`))
    );
  } catch {
    return false;
  }
}

function getTemplate(templateKey: string): StorefrontTemplateDefinition | undefined {
  return templateRegistry.find((item) => item.templateKey === templateKey);
}

function normalizeLanguageSettings(value: unknown): StorefrontLanguageSettings {
  const parsed = storefrontLanguageSettingsSchema.safeParse(value);
  return parsed.success
    ? parsed.data
    : { ...defaultStorefrontLanguageSettings, enabledLocales: ["en"] };
}

function normalizeLocalizedContent(value: unknown): StorefrontLocalizedContent {
  const parsed = storefrontLocalizedContentSchema.safeParse(value);
  return parsed.success
    ? parsed.data
    : { ...emptyStorefrontLocalizedContent, locales: {} };
}

export function validateStorefrontLocalizedContent(input: {
  data: unknown;
  localizedContent: StorefrontLocalizedContent;
  templateKey: string;
}) {
  const manifest = getStorefrontLocalizationManifest(input.templateKey);
  if (!manifest) return false;
  const allowed = new Set(["seo.title", "seo.description"]);

  for (const field of manifest.fields) {
    if (field.localization !== "localized") continue;
    if (field.kind === "links") {
      const links = getValueAtPath(input.data, field.path);
      if (Array.isArray(links)) {
        links.forEach((_, index) => allowed.add(`${field.path}.${index}.label`));
      }
      continue;
    }
    allowed.add(field.path);
  }

  return Object.values(input.localizedContent.locales).every((entries) =>
    Object.keys(entries ?? {}).every((path) => allowed.has(path)),
  );
}

type StorefrontDraftPayloadInput = {
  data: unknown;
  templateKey: string;
  themeTokens: unknown;
};

type ProductionNormalizedStorefrontDraft = {
  data: StorefrontTemplateDefinition["schema"]["_output"];
  themeTokens: StorefrontTemplateDefinition["themeSchema"]["_output"];
};

export function normalizeStorefrontDraftPayload(
  input: StorefrontDraftPayloadInput,
): ProductionNormalizedStorefrontDraft | undefined;
export function normalizeStorefrontDraftPayload(
  input: StorefrontDraftPayloadInput,
  resolveTemplate: (templateKey: string) => StorefrontDraftTemplateDefinition | undefined,
): { data: unknown; themeTokens: unknown } | undefined;
export function normalizeStorefrontDraftPayload(
  input: StorefrontDraftPayloadInput,
  resolveTemplate: (templateKey: string) => StorefrontDraftTemplateDefinition | undefined = getTemplate,
) {
  const template = resolveTemplate(input.templateKey);

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

    // Empty default arrays are open collections (for example selected product
    // and collection IDs). Merging each entry against `{}` turns scalar IDs
    // into empty objects and makes an otherwise valid draft fail its schema.
    if (defaultValue.length === 0) {
      return cloneJson(value);
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
  saved?: { data: unknown; localizedContent?: unknown; themeTokens: unknown } | null | undefined;
}) {
  if (input.mode === "resume" && input.saved) {
    return {
      data: input.saved.data,
      localizedContent: normalizeLocalizedContent(input.saved.localizedContent),
      source: "saved" as const,
      themeTokens: input.saved.themeTokens,
    };
  }
  return {
    data: input.defaultData,
    localizedContent: normalizeLocalizedContent(undefined),
    source: "clean" as const,
    themeTokens: input.defaultThemeTokens,
  };
}

export function createStorefrontTemplateService(
  db: PlatformDb,
  options: { demoBaseUrl?: string | null; getLaunchReadiness?: (input: { tenantId: string }) => Promise<import("@ecs/contracts").LaunchReadiness | null> } = {},
) {
  async function getStorefrontDraft(input: { tenantId: string }): Promise<StorefrontDraftResult> {
    const [draft] = await db
      .select({
        tenantId: storefrontConfigs.tenantId,
        shopDetails: tenants.shopDetails,
        templateId: storefrontConfigs.draftTemplateId,
        templateVersion: storefrontConfigs.draftTemplateVersion,
        templateKey: storefrontTemplateVersions.templateKey,
        data: storefrontConfigs.draftData,
        themeTokens: storefrontConfigs.draftThemeTokens,
        seoSettings: storefrontConfigs.seoSettings,
        languageSettings: storefrontConfigs.languageSettings,
        localizedContent: storefrontConfigs.localizedContent,
        updatedAt: storefrontConfigs.updatedAt,
        publishedRevisionId: storefrontConfigs.publishedRevisionId,
        publishedAt: storefrontConfigs.publishedAt,
        publishedTemplateKey: storefrontRevisions.templateKey,
        publishedData: storefrontRevisions.data,
        publishedThemeTokens: storefrontRevisions.themeTokens,
        publishedSeoSettings: storefrontRevisions.seoSettings,
        publishedLanguageSettings: storefrontRevisions.languageSettings,
        publishedLocalizedContent: storefrontRevisions.localizedContent,
      })
      .from(storefrontConfigs)
      .innerJoin(tenants, eq(tenants.id, storefrontConfigs.tenantId))
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
        data: applyShopDetails(draft.data, draft.shopDetails),
        themeTokens: draft.themeTokens,
        seo: normalizeStorefrontSeoSettings(draft.seoSettings),
        languageSettings: normalizeLanguageSettings(draft.languageSettings),
        localizedContent: normalizeLocalizedContent(draft.localizedContent),
        updatedAt: draft.updatedAt.toISOString(),
        published:
          draft.publishedRevisionId && draft.publishedAt
            ? {
                revisionId: draft.publishedRevisionId,
                publishedAt: draft.publishedAt.toISOString(),
                templateKey: draft.publishedTemplateKey,
                data: applyShopDetails(draft.publishedData, draft.shopDetails),
                themeTokens: draft.publishedThemeTokens,
                seo: normalizeStorefrontSeoSettings(draft.publishedSeoSettings),
                languageSettings: normalizeLanguageSettings(draft.publishedLanguageSettings),
                localizedContent: normalizeLocalizedContent(draft.publishedLocalizedContent),
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
          shopDetails: tenants.shopDetails,
          templateId: storefrontRevisions.templateId,
          templateVersion: storefrontRevisions.templateVersion,
          templateKey: storefrontRevisions.templateKey,
          data: storefrontRevisions.data,
          themeTokens: storefrontRevisions.themeTokens,
          languageSettings: storefrontRevisions.languageSettings,
          localizedContent: storefrontRevisions.localizedContent,
          publishedAt: storefrontRevisions.publishedAt,
          seoSettings: storefrontRevisions.seoSettings,
        })
        .from(storefrontRevisions)
        .innerJoin(tenants, eq(tenants.id, storefrontRevisions.tenantId))
        .innerJoin(storefrontConfigs, eq(storefrontConfigs.tenantId, storefrontRevisions.tenantId))
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
          data: applyShopDetails(revision.data, revision.shopDetails),
          themeTokens: revision.themeTokens,
          languageSettings: normalizeLanguageSettings(revision.languageSettings),
          localizedContent: normalizeLocalizedContent(revision.localizedContent),
          publishedAt: revision.publishedAt.toISOString(),
          seo: normalizeStorefrontSeoSettings(revision.seoSettings),
        },
      };
    },
    getStorefrontSeoSettings: async (input: {
      tenantId: string;
    }): Promise<StorefrontSeoSettingsResult> => {
      const [row] = await db
        .select({ seo: storefrontConfigs.seoSettings })
        .from(storefrontConfigs)
        .where(eq(storefrontConfigs.tenantId, input.tenantId))
        .limit(1);
      return row
        ? { ok: true, seo: normalizeStorefrontSeoSettings(row.seo) }
        : { ok: false, error: "storefront_draft_not_found" };
    },
    updateStorefrontSeoSettings: async (input: {
      seo: StorefrontSeoSettings;
      tenantId: string;
      userId: string;
    }): Promise<StorefrontSeoSettingsResult> => {
      const [updated] = await db.transaction(async (transaction) => {
        const rows = await transaction
          .update(storefrontConfigs)
          .set({
            seoSettings: input.seo,
            updatedAt: new Date(),
          })
          .where(eq(storefrontConfigs.tenantId, input.tenantId))
          .returning({
            seo: storefrontConfigs.seoSettings,
          });
        if (!rows[0]) return [];
        await transaction.insert(auditLogs).values({
          actorUserId: input.userId,
          tenantId: input.tenantId,
          action: "storefront.seo_updated",
          targetType: "storefront_config",
          targetId: input.tenantId,
          metadata: {
            hasDescription: Boolean(input.seo.description),
            hasSocialImage: Boolean(input.seo.socialImageUrl),
            hasTitle: Boolean(input.seo.title),
          },
        });
        return rows;
      });
      return updated
        ? { ok: true, seo: normalizeStorefrontSeoSettings(updated.seo) }
        : { ok: false, error: "storefront_draft_not_found" };
    },
    listStorefrontTemplates: async (): Promise<StorefrontTemplateCatalogItem[]> => {
      const rows = await db
        .select({
          id: dbStorefrontTemplates.id,
          slug: dbStorefrontTemplates.slug,
          name: dbStorefrontTemplates.name,
          description: dbStorefrontTemplates.description,
          previewAssetId: storefrontTemplateVersions.previewAssetId,
          previewAltText: storefrontTemplateVersions.previewAltText,
          previewUrl: platformAssets.publicUrl,
          demoUrl: storefrontTemplateVersions.demoUrl,
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
        .leftJoin(
          platformAssets,
          and(
            eq(storefrontTemplateVersions.previewAssetId, platformAssets.id),
            eq(platformAssets.status, "ready"),
          ),
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
        tags: row.tags,
        minimumPlanId: row.minimumPlanId,
        version: {
          id: row.versionId,
          version: row.version,
          templateKey: row.templateKey,
          previewData: row.previewData,
          previewAssetId: row.previewAssetId,
          previewAltText: row.previewAltText,
          previewUrl: row.previewUrl,
          demoUrl: row.demoUrl ?? getDefaultTemplateDemoUrl(options.demoBaseUrl ?? null, row.slug),
        },
      }));
    },
    getStorefrontDraft,
    updateStorefrontDraft: async (input: {
      data: unknown;
      languageSettings?: StorefrontLanguageSettings;
      localizedContent?: StorefrontLocalizedContent;
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

      const languageSettings = normalizeLanguageSettings(
        input.languageSettings ?? currentDraft.draft.languageSettings,
      );
      const localizedContent = normalizeLocalizedContent(
        input.localizedContent ?? currentDraft.draft.localizedContent,
      );
      if (!validateStorefrontLocalizedContent({
        data: normalizedDraft.data,
        localizedContent,
        templateKey: currentDraft.draft.templateKey,
      })) {
        return { ok: false, error: "invalid_storefront_draft" };
      }

      const updated = await db.transaction(async (transaction) => {
        const [row] = await transaction
          .update(storefrontConfigs)
          .set({
            draftData: normalizedDraft.data,
            draftThemeTokens: normalizedDraft.themeTokens,
            languageSettings,
            localizedContent,
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
              localizedContent,
              updatedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: [
                storefrontTemplateDrafts.tenantId,
                storefrontTemplateDrafts.templateVersionId,
              ],
              set: {
                data: normalizedDraft.data,
                themeTokens: normalizedDraft.themeTokens,
                localizedContent,
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
      let reviewedFingerprint: string | undefined;
      if (options.getLaunchReadiness) {
        const readiness = await options.getLaunchReadiness({ tenantId: input.tenantId });
        if (!readiness || !readiness.canPublish) return {
          ok: false,
          error: readiness?.checks.some((check) => check.status === "unavailable") ? "launch_check_unavailable" : "launch_not_ready",
          ...(readiness ? { readiness } : {}),
        };
        reviewedFingerprint = readiness.draftFingerprint;
      }
      const published = await db.transaction(async (transaction) => {
        if (reviewedFingerprint) {
          const [config] = await transaction.select().from(storefrontConfigs).where(eq(storefrontConfigs.tenantId, input.tenantId)).for("update").limit(1);
          const [tenant] = await transaction.select().from(tenants).where(eq(tenants.id, input.tenantId)).for("update").limit(1);
          if (!config || !tenant || createHash("sha256").update(JSON.stringify([tenant.name, tenant.shopDetails, config.draftTemplateId, config.draftData, config.draftThemeTokens, config.languageSettings, config.localizedContent, config.seoSettings])).digest("hex") !== reviewedFingerprint) return "review_stale";
        }
        const [draft] = await transaction
          .select({
            tenantId: storefrontConfigs.tenantId,
            templateId: storefrontConfigs.draftTemplateId,
            templateVersion: storefrontConfigs.draftTemplateVersion,
            templateKey: storefrontTemplateVersions.templateKey,
            data: storefrontConfigs.draftData,
            themeTokens: storefrontConfigs.draftThemeTokens,
            languageSettings: storefrontConfigs.languageSettings,
            localizedContent: storefrontConfigs.localizedContent,
            seoSettings: storefrontConfigs.seoSettings,
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
            languageSettings: normalizeLanguageSettings(draft.languageSettings),
            localizedContent: normalizeLocalizedContent(draft.localizedContent),
            seoSettings: normalizeStorefrontSeoSettings(draft.seoSettings),
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

        const [onboarding] = await transaction.select().from(tenantOnboarding).where(eq(tenantOnboarding.tenantId, input.tenantId)).for("update").limit(1);
        let completedSteps = onboarding?.completedSteps;
        if (reviewedFingerprint) {
          completedSteps = [
            ...(Array.isArray(completedSteps)
              ? completedSteps.filter(
                  (step) =>
                    typeof step === "string" &&
                    step !== "storefront_reviewed" &&
                    !step.startsWith("storefront_review:"),
                )
              : []),
            "storefront_reviewed",
          ];
        }
        if (onboarding) await transaction.update(tenantOnboarding).set({ status: "completed", currentStep: "completed", ...(completedSteps ? { completedSteps } : {}), updatedAt: new Date() }).where(eq(tenantOnboarding.tenantId, input.tenantId));

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

      if (published === "review_stale") return { ok: false, error: "launch_not_ready" };

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
            localizedContent: storefrontConfigs.localizedContent,
          })
          .from(storefrontConfigs)
          .where(eq(storefrontConfigs.tenantId, tenant.id))
          .limit(1);

        if (current?.templateId && current.templateVersion) {
          const [currentVersion] = await transaction
            .select({ id: storefrontTemplateVersions.id })
            .from(storefrontTemplateVersions)
            .where(
              and(
                eq(storefrontTemplateVersions.templateId, current.templateId),
                eq(storefrontTemplateVersions.version, current.templateVersion),
              ),
            )
            .limit(1);
          if (currentVersion) {
            await transaction
              .insert(storefrontTemplateDrafts)
              .values({
                tenantId: tenant.id,
                templateVersionId: currentVersion.id,
                data: current.data,
                themeTokens: current.themeTokens,
                localizedContent: normalizeLocalizedContent(current.localizedContent),
                updatedAt: new Date(),
              })
              .onConflictDoUpdate({
                target: [
                  storefrontTemplateDrafts.tenantId,
                  storefrontTemplateDrafts.templateVersionId,
                ],
                set: {
                  data: current.data,
                  themeTokens: current.themeTokens,
                  localizedContent: normalizeLocalizedContent(current.localizedContent),
                  updatedAt: new Date(),
                },
              });
          }
        }

        const [saved] = await transaction
          .select({
            data: storefrontTemplateDrafts.data,
            themeTokens: storefrontTemplateDrafts.themeTokens,
            localizedContent: storefrontTemplateDrafts.localizedContent,
          })
          .from(storefrontTemplateDrafts)
          .where(
            and(
              eq(storefrontTemplateDrafts.tenantId, tenant.id),
              eq(storefrontTemplateDrafts.templateVersionId, template.versionId),
            ),
          )
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
                localizedContent: storefrontRevisions.localizedContent,
              })
              .from(storefrontRevisions)
              .where(eq(storefrontRevisions.id, current.publishedRevisionId))
              .limit(1)
          : [];
        const hasUnpublishedChanges = Boolean(
          published &&
            (published.templateKey !== template.templateKey ||
              !isDeepStrictEqual(published.data, next.data) ||
              !isDeepStrictEqual(published.themeTokens, next.themeTokens) ||
              !isDeepStrictEqual(
                normalizeLocalizedContent(published.localizedContent),
                next.localizedContent,
              )),
        );

        const [draft] = await transaction
          .insert(storefrontConfigs)
          .values({
            tenantId: tenant.id,
            draftTemplateId: template.id,
            draftTemplateVersion: template.version,
            draftData: next.data,
            draftThemeTokens: next.themeTokens,
            localizedContent: next.localizedContent,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: storefrontConfigs.tenantId,
            set: {
              draftTemplateId: template.id,
              draftTemplateVersion: template.version,
              draftData: next.data,
              draftThemeTokens: next.themeTokens,
              localizedContent: next.localizedContent,
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

function getValueAtPath(value: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, segment) => {
    if (Array.isArray(current)) return current[Number(segment)];
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[segment];
  }, value);
}

function cloneJson(value: unknown) {
  if (value === undefined) {
    return undefined;
  }

  return JSON.parse(JSON.stringify(value)) as unknown;
}
