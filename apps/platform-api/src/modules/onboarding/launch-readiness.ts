import { createHash } from "node:crypto";
import { type LaunchReadiness, shopDetailsSchema } from "@ecs/contracts";
import {
  auditLogs,
  type createPlatformDb,
  deliverySettings,
  storefrontConfigs,
  tenantOnboarding,
  tenants,
} from "@ecs/db";
import { eq } from "drizzle-orm";
import type { MerchantProduct, MerchantProductsResult } from "../../types/index.js";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];
type CheckStatus = LaunchReadiness["checks"][number]["status"];

export function isPurchasableLaunchProduct(product: MerchantProduct): boolean {
  return (
    product.status === "published" &&
    Boolean(product.handle?.trim()) &&
    Boolean(
      product.variants?.some(
        (variant) =>
          variant.prices.some(
            (price) =>
              price.currencyCode?.toLowerCase() === "etb" &&
              typeof price.amount === "number" &&
              Number.isFinite(price.amount) &&
              price.amount >= 0,
          ) &&
          (variant.manageInventory === false ||
            variant.allowBackorder === true ||
            (variant.stock?.availableQuantity ?? 0) > 0),
      ),
    )
  );
}

export function buildLaunchReadiness(input: {
  tenantId: string;
  name: string;
  handle: string;
  shopDetails: unknown;
  isPublished: boolean;
  data: unknown;
  themeTokens: unknown;
  languageSettings?: unknown;
  localizedContent?: unknown;
  seoSettings?: unknown;
  templateId: string | null;
  completedSteps: unknown;
  catalogStatus: CheckStatus;
  delivery?: { deliveryEnabled: boolean; pickupEnabled: boolean };
}): LaunchReadiness {
  const draftFingerprint = createHash("sha256")
    .update(
      JSON.stringify([
        input.name,
        input.shopDetails,
        input.templateId,
        input.data,
        input.themeTokens,
        input.languageSettings,
        input.localizedContent,
        input.seoSettings,
      ]),
    )
    .digest("hex");
  const details = shopDetailsSchema.safeParse(input.shopDetails);
  const profileReady =
    Boolean(input.name.trim() && input.handle.trim()) &&
    (details.success || (input.isPublished && input.shopDetails == null));
  const fulfillmentReady = Boolean(
    input.delivery && (input.delivery.deliveryEnabled || input.delivery.pickupEnabled),
  );
  const reviewReady =
    Array.isArray(input.completedSteps) &&
    input.completedSteps.includes(`storefront_review:${draftFingerprint}`);
  const checks: LaunchReadiness["checks"] = [
    { id: "profile", status: profileReady ? "ready" : "action_required" },
    { id: "catalog", status: input.catalogStatus },
    { id: "fulfillment", status: fulfillmentReady ? "ready" : "action_required" },
    { id: "review", status: input.templateId && reviewReady ? "ready" : "action_required" },
  ];
  return {
    tenantId: input.tenantId,
    isPublished: input.isPublished,
    draftFingerprint,
    checks,
    canPublish: checks.every((check) => check.status === "ready"),
  };
}

export function createLaunchReadinessService(
  db: PlatformDb,
  options: {
    listProducts: (input: {
      salesChannelId: string;
      stockLocationId: string;
      status: string;
      limit: number;
      offset: number;
    }) => Promise<MerchantProductsResult>;
  },
) {
  async function snapshot(tenantId: string) {
    const [row] = await db
      .select({
        tenant: tenants,
        config: storefrontConfigs,
        delivery: deliverySettings,
        onboarding: tenantOnboarding,
      })
      .from(tenants)
      .leftJoin(storefrontConfigs, eq(storefrontConfigs.tenantId, tenants.id))
      .leftJoin(deliverySettings, eq(deliverySettings.tenantId, tenants.id))
      .leftJoin(tenantOnboarding, eq(tenantOnboarding.tenantId, tenants.id))
      .where(eq(tenants.id, tenantId))
      .limit(1);
    return row;
  }
  async function getLaunchReadiness(input: { tenantId: string }): Promise<LaunchReadiness | null> {
    const row = await snapshot(input.tenantId);
    if (!row) return null;
    const tenant = row.tenant;
    const commerceReady = Boolean(
      tenant.medusaStoreId &&
        tenant.medusaSalesChannelId &&
        tenant.medusaStockLocationId &&
        tenant.medusaRegionId &&
        tenant.medusaPublishableKeyId &&
        tenant.medusaShippingOptionId,
    );
    let catalogStatus: CheckStatus = "unavailable";
    let stockUnverified = false;
    if (commerceReady) {
      try {
        for (let offset = 0; offset < 1000; offset += 50) {
          const result = await options.listProducts({
            salesChannelId: tenant.medusaSalesChannelId!,
            stockLocationId: tenant.medusaStockLocationId!,
            status: "published",
            limit: 50,
            offset,
          });
          if (!result.ok) break;
          stockUnverified ||= result.products.some((product) =>
            product.variants?.some(
              (variant) =>
                variant.prices.some(
                  (price) =>
                    price.currencyCode?.toLowerCase() === "etb" &&
                    typeof price.amount === "number" &&
                    Number.isFinite(price.amount) &&
                    price.amount >= 0,
                ) &&
                variant.manageInventory !== false &&
                variant.allowBackorder !== true &&
                variant.stock?.availableQuantity == null,
            ),
          );
          if (result.products.some(isPurchasableLaunchProduct)) {
            catalogStatus = "ready";
            break;
          }
          if (offset + result.products.length >= result.count) {
            catalogStatus = stockUnverified ? "unavailable" : "action_required";
            break;
          }
          if (!result.products.length) break;
        }
      } catch {
        /* Unknown must never be presented as an empty catalog. */
      }
    }
    return buildLaunchReadiness({
      tenantId: input.tenantId,
      name: tenant.name,
      handle: tenant.handle,
      shopDetails: tenant.shopDetails,
      isPublished: Boolean(row.config?.publishedRevisionId),
      data: row.config?.draftData,
      themeTokens: row.config?.draftThemeTokens,
      languageSettings: row.config?.languageSettings,
      localizedContent: row.config?.localizedContent,
      seoSettings: row.config?.seoSettings,
      templateId: row.config?.draftTemplateId ?? null,
      completedSteps: row.onboarding?.completedSteps,
      catalogStatus,
      delivery: row.delivery ?? { deliveryEnabled: true, pickupEnabled: true },
    });
  }
  async function confirmStorefrontReview(input: {
    tenantId: string;
    userId: string;
    draftFingerprint: string;
  }) {
    return db.transaction(async (transaction) => {
      // Lock the design while recording its review, so a concurrent save cannot be marked reviewed.
      const [config] = await transaction
        .select()
        .from(storefrontConfigs)
        .where(eq(storefrontConfigs.tenantId, input.tenantId))
        .for("update")
        .limit(1);
      const [tenant] = await transaction
        .select()
        .from(tenants)
        .where(eq(tenants.id, input.tenantId))
        .for("update")
        .limit(1);
      if (!config || !tenant) return false;
      const fingerprint = createHash("sha256")
        .update(
          JSON.stringify([
            tenant.name,
            tenant.shopDetails,
            config.draftTemplateId,
            config.draftData,
            config.draftThemeTokens,
            config.languageSettings,
            config.localizedContent,
            config.seoSettings,
          ]),
        )
        .digest("hex");
      if (fingerprint !== input.draftFingerprint) return false;
      const [onboarding] = await transaction
        .select()
        .from(tenantOnboarding)
        .where(eq(tenantOnboarding.tenantId, input.tenantId))
        .for("update")
        .limit(1);
      const steps = Array.isArray(onboarding?.completedSteps)
        ? onboarding.completedSteps.filter(
            (step): step is string =>
              typeof step === "string" && !step.startsWith("storefront_review:"),
          )
        : [];
      await transaction
        .insert(tenantOnboarding)
        .values({
          tenantId: input.tenantId,
          completedSteps: [...steps, `storefront_review:${fingerprint}`],
          currentStep: "publish",
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: tenantOnboarding.tenantId,
          set: {
            completedSteps: [...steps, `storefront_review:${fingerprint}`],
            currentStep: "publish",
            updatedAt: new Date(),
          },
        });
      await transaction.insert(auditLogs).values({
        tenantId: input.tenantId,
        actorUserId: input.userId,
        action: "storefront.review_confirmed",
        targetType: "tenant",
        targetId: input.tenantId,
        metadata: { draftFingerprint: fingerprint },
      });
      return true;
    });
  }
  return { getLaunchReadiness, confirmStorefrontReview };
}
