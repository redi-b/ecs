import type { MerchantDashboardAccess } from "@ecs/contracts";

import type { MessageKey } from "@/i18n/messages";
import { dashboardRoutes } from "@/lib/routes";

function formatCount(value: number) {
  return value.toLocaleString();
}

function withCreate(href: string, create: string) {
  const url = new URL(href, "http://local.invalid");
  url.searchParams.set("create", create);
  return `${url.pathname}${url.search}`;
}

export type LaunchChecklistItem = {
  id: string;
  label: string;
  description: string;
  ready: boolean;
  href: string;
  required: boolean;
  current: boolean;
};

export type LaunchAssistantData = MerchantDashboardAccess & {
  productCount: number;
};

export function getLaunchChecklistItems(
  summary: LaunchAssistantData,
  t: (key: MessageKey, values?: Record<string, string | number | Date>) => string,
): LaunchChecklistItem[] {
  const hasShopProfile = Boolean(
    summary.tenant.name.trim() && summary.tenant.handle.trim() && summary.domain.hostname.trim(),
  );
  const hasCatalog = summary.productCount > 0;
  const hasStorefrontDraft = Boolean(
    summary.storefront.templateKey ?? summary.storefront.templateId,
  );
  const hasPublishedStorefront = summary.storefront.isPublished;
  const requiredStates = [hasShopProfile, hasStorefrontDraft, hasCatalog, hasPublishedStorefront];
  const nextRequiredIndex = requiredStates.findIndex((state) => !state);

  const required: Omit<LaunchChecklistItem, "current">[] = [
    {
      id: "profile",
      label: t("overview.launch.shopProfile"),
      description: hasShopProfile
        ? summary.domain.hostname
        : t("overview.launch.shopProfileMissing"),
      ready: hasShopProfile,
      href: dashboardRoutes.settings,
      required: true,
    },
    {
      id: "design",
      label: t("overview.launch.storefrontDesign"),
      description: hasStorefrontDraft
        ? t("overview.launch.storefrontSelected")
        : t("overview.launch.chooseStorefront"),
      ready: hasStorefrontDraft,
      href: hasStorefrontDraft
        ? dashboardRoutes.editor
        : `${dashboardRoutes.settings}?tab=storefront`,
      required: true,
    },
    {
      id: "catalog",
      label: t("overview.launch.catalog"),
      description: hasCatalog
        ? t("overview.launch.catalogDesc", { count: formatCount(summary.productCount) })
        : t("overview.launch.catalogEmpty"),
      ready: hasCatalog,
      href: hasCatalog ? dashboardRoutes.products : withCreate(dashboardRoutes.products, "product"),
      required: true,
    },
    {
      id: "publish",
      label: t("overview.launch.publishStorefront"),
      description: hasPublishedStorefront
        ? t("overview.launch.customersCanAccess")
        : t("overview.launch.reviewAndPublish"),
      ready: hasPublishedStorefront,
      href: `${dashboardRoutes.settings}?tab=storefront`,
      required: true,
    },
  ];

  const optional: Omit<LaunchChecklistItem, "current">[] = [
    {
      id: "fulfillment",
      label: t("overview.launch.fulfillment"),
      description: t("overview.launch.fulfillmentDesc"),
      ready: false,
      href: `${dashboardRoutes.settings}?tab=fulfillment`,
      required: false,
    },
    {
      id: "payments",
      label: t("overview.launch.payments"),
      description: t("overview.launch.paymentsDesc"),
      ready: false,
      href: `${dashboardRoutes.settings}?tab=payments`,
      required: false,
    },
  ];

  return [
    ...required.map((item, index) => ({ ...item, current: index === nextRequiredIndex })),
    ...optional.map((item) => ({ ...item, current: false })),
  ];
}
