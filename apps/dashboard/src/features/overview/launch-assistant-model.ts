import type { LaunchReadiness, MerchantDashboardAccess } from "@ecs/contracts";

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
  unavailable?: boolean;
};

export type LaunchAssistantData = MerchantDashboardAccess & {
  hasVisitedEditor: boolean;
  productCount: number | null;
  productCountUnavailable?: boolean;
  readiness?: LaunchReadiness | null;
};

export function getLaunchChecklistItems(
  summary: LaunchAssistantData,
  t: (key: MessageKey, values?: Record<string, string | number | Date>) => string,
): LaunchChecklistItem[] {
  if (summary.readiness !== undefined) {
    const readiness = summary.readiness;
    const required: Omit<LaunchChecklistItem, "current">[] = (
      ["profile", "catalog", "review"] as const
    ).map((id) => {
      const check = readiness?.checks.find((item) => item.id === id);
      const status = check?.status ?? "unavailable";
      const href =
        id === "profile"
          ? `${dashboardRoutes.settings}?section=shop`
          : id === "catalog"
            ? dashboardRoutes.products
            : dashboardRoutes.editor;
      return {
        id,
        label: t(`overview.launch.checks.${id}`),
        description:
          status === "unavailable"
            ? t("overview.launch.checks.unavailable")
            : t(`overview.launch.checks.${id}${status === "ready" ? "Ready" : "Help"}`),
        ready: status === "ready",
        unavailable: status === "unavailable",
        href,
        required: true,
      };
    });
    const fulfillment = readiness?.checks.find((item) => item.id === "fulfillment");
    if (fulfillment && fulfillment.status !== "ready") {
      required.splice(2, 0, {
        id: "fulfillment",
        label: t("overview.launch.checks.fulfillment"),
        description: t(
          fulfillment.status === "unavailable"
            ? "overview.launch.checks.unavailable"
            : "overview.launch.checks.fulfillmentHelp",
        ),
        ready: false,
        unavailable: fulfillment.status === "unavailable",
        href: `${dashboardRoutes.settings}?section=fulfillment`,
        required: true,
      });
    }
    const isPublished = readiness?.isPublished ?? summary.storefront.isPublished;
    required.push({
      id: "publish",
      label: t("overview.launch.publishStorefront"),
      description: t(
        isPublished ? "overview.launch.customersCanAccess" : "overview.launch.reviewAndPublish",
      ),
      ready: isPublished,
      href: dashboardRoutes.editor,
      required: true,
    });
    const next = required.findIndex((item) => !item.ready);
    const localizedStorefront: Omit<LaunchChecklistItem, "current">[] = isPublished
      ? [
          {
            id: "storefront-language",
            label: t("overview.launch.checks.translation"),
            description: t("overview.launch.checks.translationHelp"),
            ready: false,
            href: "/dashboard/storefront/translations",
            required: false,
          },
        ]
      : [];
    return [
      ...required.map((item, index) => ({
        ...item,
        current: index === next && !item.unavailable,
      })),
      ...localizedStorefront.map((item) => ({ ...item, current: false })),
    ];
  }
  const hasShopProfile = Boolean(
    summary.tenant.name.trim() && summary.tenant.handle.trim() && summary.domain.hostname.trim(),
  );
  const hasCatalog = (summary.productCount ?? 0) > 0;
  const catalogUnknown = summary.productCount === null || summary.productCountUnavailable === true;
  const hasStorefrontDraft = Boolean(
    summary.storefront.templateKey ?? summary.storefront.templateId,
  );
  const hasPublishedStorefront = summary.storefront.isPublished;
  const hasReviewedStorefront =
    hasPublishedStorefront || (hasStorefrontDraft && summary.hasVisitedEditor);
  const requiredStates = [
    hasShopProfile,
    hasReviewedStorefront,
    hasCatalog,
    hasPublishedStorefront,
  ];
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
      description: hasReviewedStorefront
        ? t("overview.launch.storefrontSelected")
        : t("overview.launch.chooseStorefront"),
      ready: hasReviewedStorefront,
      href: hasStorefrontDraft
        ? dashboardRoutes.editor
        : `${dashboardRoutes.settings}?section=storefront`,
      required: true,
    },
    {
      id: "catalog",
      label: t("overview.launch.catalog"),
      description: hasCatalog
        ? t("overview.launch.catalogDesc", { count: formatCount(summary.productCount ?? 0) })
        : summary.productCount === null
          ? t(
              summary.productCountUnavailable
                ? "overview.launch.catalogUnavailable"
                : "overview.launch.catalogChecking",
            )
          : t("overview.launch.catalogEmpty"),
      ready: hasCatalog,
      href:
        hasCatalog || catalogUnknown
          ? dashboardRoutes.products
          : withCreate(dashboardRoutes.products, "product"),
      required: true,
    },
    {
      id: "publish",
      label: t("overview.launch.publishStorefront"),
      description: hasPublishedStorefront
        ? t("overview.launch.customersCanAccess")
        : t("overview.launch.reviewAndPublish"),
      ready: hasPublishedStorefront,
      href: dashboardRoutes.editor,
      required: true,
    },
  ];

  const optional: Omit<LaunchChecklistItem, "current">[] = [
    {
      id: "fulfillment",
      label: t("overview.launch.fulfillment"),
      description: t("overview.launch.fulfillmentDesc"),
      ready: false,
      href: `${dashboardRoutes.settings}?section=fulfillment`,
      required: false,
    },
    {
      id: "payments",
      label: t("overview.launch.payments"),
      description: t("overview.launch.paymentsDesc"),
      ready: false,
      href: `${dashboardRoutes.settings}?section=payments`,
      required: false,
    },
  ];

  return [
    ...required.map((item, index) => ({
      ...item,
      current: index === nextRequiredIndex && !(item.id === "catalog" && catalogUnknown),
    })),
    ...optional.map((item) => ({ ...item, current: false })),
  ];
}
