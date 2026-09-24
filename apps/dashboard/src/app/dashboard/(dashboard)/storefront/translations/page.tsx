import { RiSettings4Line, RiTranslate2 } from "@remixicon/react";
import { headers } from "next/headers";
import { HelpTip } from "@/components/app/help-tip";
import Link from "@/components/app/link";
import { PageShell } from "@/components/app/page-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { StorefrontTranslationWorkspace } from "@/features/storefront-editor/storefront-translation-workspace";
import { getTranslations } from "@/i18n/server";
import { type DashboardSearchParams, getSelectedTenantId } from "@/lib/dashboard-tenant-context";
import { getMerchantDashboardAccessShell } from "@/lib/merchant-dashboard";
import { mapPlatformErrorMessage } from "@/lib/platform-api/errors";
import {
  getStorefrontTranslationFields,
  getStorefrontTranslationStatus,
} from "@/lib/storefront-localization-fields";
import { getStorefrontDraft } from "@/lib/storefront-templates";
import { getStorefrontTranslationReadiness } from "@/lib/storefront-translation-readiness";

const translationLocale = "am" as const;

function TranslationPageHelp({ summary, title }: { summary: string; title: string }) {
  return <HelpTip label={title} summary={summary} title={title} />;
}

export default async function StorefrontTranslationsPage({
  searchParams,
}: {
  searchParams?: Promise<DashboardSearchParams>;
}) {
  const t = await getTranslations();
  const requestHeaders = await headers();
  const tenantId = getSelectedTenantId((await searchParams) ?? {});
  const platformApiBaseUrl = process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000";
  const access = await getMerchantDashboardAccessShell({
    cookieHeader: requestHeaders.get("cookie"),
    platformApiBaseUrl,
    requestHost: requestHeaders.get("host"),
    tenantId,
  });
  const draft = access.ok
    ? await getStorefrontDraft({
        cookieHeader: requestHeaders.get("cookie"),
        platformApiBaseUrl,
        tenantId: access.access.tenant.id,
      })
    : null;

  if (!access.ok || !draft?.ok) {
    const message = !access.ok
      ? mapPlatformErrorMessage(access.message, { resource: "Storefront" })
      : draft && !draft.ok
        ? draft.message
        : t("editor.translations.loadError");
    return (
      <PageShell
        title={t("editor.translations.title")}
        titleAccessory={
          <TranslationPageHelp
            summary={t("editor.translations.description")}
            title={t("editor.translations.title")}
          />
        }
      >
        <Alert variant="destructive">
          <AlertTitle>{t("editor.translations.loadError")}</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      </PageShell>
    );
  }
  if (!draft.draft.languageSettings.enabledLocales.includes("am")) {
    return (
      <PageShell
        title={t("editor.translations.title")}
        titleAccessory={
          <TranslationPageHelp
            summary={t("editor.translations.description")}
            title={t("editor.translations.title")}
          />
        }
      >
        <Empty className="min-h-72 rounded-2xl border border-dashed">
          <EmptyHeader>
            <RiTranslate2 className="size-5 text-muted-foreground" />
            <EmptyTitle>{t("editor.translations.disabledTitle")}</EmptyTitle>
            <EmptyDescription>{t("editor.translations.disabledDescription")}</EmptyDescription>
          </EmptyHeader>
          <Button asChild size="sm">
            <Link href="/dashboard/settings?tab=storefront">
              {t("editor.translations.openSettings")}
            </Link>
          </Button>
        </Empty>
      </PageShell>
    );
  }

  const fields = getStorefrontTranslationFields({
    data: draft.draft.data,
    seo: draft.draft.seo,
    templateKey: draft.draft.templateKey,
  }).map((field) => ({
    ...field,
    initialStatus: getStorefrontTranslationStatus({
      field,
      locale: translationLocale,
      localizedContent: draft.draft.localizedContent,
    }),
    translation:
      draft.draft.localizedContent.locales[translationLocale]?.[field.path]?.value ??
      field.defaultTranslation ??
      "",
  }));
  const readinessContext = {
    cookieHeader: requestHeaders.get("cookie"),
    platformApiBaseUrl,
    requestHost: requestHeaders.get("host"),
    tenantId: access.access.tenant.id,
  };
  const [productReadiness, categoryReadiness, collectionReadiness, shippingReadiness] =
    await Promise.all([
      getStorefrontTranslationReadiness({
        ...readinessContext,
        limit: 6,
        locale: translationLocale,
        resourceType: "product",
      }),
      getStorefrontTranslationReadiness({
        ...readinessContext,
        limit: 6,
        locale: translationLocale,
        resourceType: "product_category",
      }),
      getStorefrontTranslationReadiness({
        ...readinessContext,
        limit: 6,
        locale: translationLocale,
        resourceType: "product_collection",
      }),
      getStorefrontTranslationReadiness({
        ...readinessContext,
        limit: 1,
        locale: translationLocale,
        resourceType: "shipping_option",
      }),
    ]);

  return (
    <PageShell
      actions={
        <Button asChild size="sm" variant="outline">
          <Link href="/dashboard/settings?tab=storefront">
            <RiSettings4Line />
            {t("editor.translations.openSettings")}
          </Link>
        </Button>
      }
      title={t("editor.translations.title")}
      titleAccessory={
        <TranslationPageHelp
          summary={t("editor.translations.description")}
          title={t("editor.translations.title")}
        />
      }
    >
      <StorefrontTranslationWorkspace
        categoryReadiness={categoryReadiness.ok ? categoryReadiness.queue : null}
        collectionReadiness={collectionReadiness.ok ? collectionReadiness.queue : null}
        fields={fields}
        locale={translationLocale}
        productReadiness={productReadiness.ok ? productReadiness.queue : null}
        shippingReadiness={shippingReadiness.ok ? shippingReadiness.queue : null}
        tenantId={draft.draft.tenantId}
      />
    </PageShell>
  );
}
