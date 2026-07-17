import { RiLayoutMasonryLine } from "@remixicon/react";
import { headers } from "next/headers";
import Link from "@/components/app/link";

import { PageShell } from "@/components/app/page-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getTranslations } from "@/i18n/server";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { StorefrontVisualEditor } from "@/features/storefront-editor/storefront-visual-editor";
import { type DashboardSearchParams, getSelectedTenantId } from "@/lib/dashboard-tenant-context";
import { getMerchantDashboardAccessShell } from "@/lib/merchant-dashboard";
import { mapPlatformErrorMessage } from "@/lib/platform-api/errors";
import {
  getStorefrontDraft,
  publishStorefrontDraft,
  updateStorefrontDraft,
} from "@/lib/storefront-templates";

type StorefrontEditorPageProps = {
  searchParams?: Promise<DashboardSearchParams>;
};

type StorefrontDraftPayload = {
  data: unknown;
  tenantId: string;
  themeTokens: unknown;
};

export default async function StorefrontEditorPage({ searchParams }: StorefrontEditorPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const selectedTenantId = getSelectedTenantId(resolvedSearchParams);
  const t = await getTranslations();
  const requestHeaders = await headers();
  const platformApiBaseUrl = process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000";
  // Editor only needs tenant name, domain, publish flag — not ops/metrics/billing.
  const access = await getMerchantDashboardAccessShell({
    cookieHeader: requestHeaders.get("cookie"),
    platformApiBaseUrl,
    requestHost: requestHeaders.get("host"),
    tenantId: selectedTenantId,
  });

  const draft =
    access.ok && access.access.tenant.id
      ? await getStorefrontDraft({
          cookieHeader: requestHeaders.get("cookie"),
          platformApiBaseUrl,
          tenantId: access.access.tenant.id,
        })
      : null;

  return (
    <PageShell
      className="gap-4 sm:gap-5"
      description={t("editor.description")}
      title={t("editor.title")}
    >
      {!access.ok ? (
        <Alert variant="destructive">
          <AlertTitle>{t("editor.error.loadTitle")}</AlertTitle>
          <AlertDescription>
            {mapPlatformErrorMessage(access.message, { resource: "Editor" })}
          </AlertDescription>
        </Alert>
      ) : !draft?.ok ? (
        <Empty className="min-h-96 border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <RiLayoutMasonryLine />
            </EmptyMedia>
            <EmptyTitle>{t("editor.empty.title")}</EmptyTitle>
            <EmptyDescription>
              {t("editor.empty.description")}
            </EmptyDescription>
            <Button asChild>
              <Link href="/admin/settings?tab=storefront">{t("editor.actions.openSettings")}</Link>
            </Button>
          </EmptyHeader>
        </Empty>
      ) : (
        <StorefrontVisualEditor
          draft={draft.draft}
          editorMeta={{
            initiallyPublished: access.access.storefront.isPublished,
            liveStorefrontUrl: getLiveStorefrontUrl(access.access.domain.hostname),
            settingsUrl: "/admin/settings?tab=storefront",
            storefrontName: access.access.tenant.name,
            templateKey: draft.draft.templateKey,
            templateName: getTemplateDisplayName(draft.draft.templateKey),
          }}
          onPublish={publishDraftAction}
          onSave={saveDraftAction}
        />
      )}
    </PageShell>
  );
}

function getTemplateDisplayName(templateKey: string) {
  return templateKey === "classic@1" ? "Classic" : templateKey;
}

function getLiveStorefrontUrl(hostname: string) {
  return `http://${hostname}`;
}

async function saveDraftAction(payload: StorefrontDraftPayload) {
  "use server";

  const requestHeaders = await headers();
  const result = await updateStorefrontDraft({
    cookieHeader: requestHeaders.get("cookie"),
    data: payload.data,
    platformApiBaseUrl: process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000",
    tenantId: payload.tenantId,
    themeTokens: payload.themeTokens,
  });

  return result.ok ? ({ ok: true } as const) : ({ ok: false, message: result.message } as const);
}

async function publishDraftAction(tenantId: string) {
  "use server";

  const requestHeaders = await headers();
  const result = await publishStorefrontDraft({
    cookieHeader: requestHeaders.get("cookie"),
    platformApiBaseUrl: process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000",
    tenantId,
  });

  return result.ok ? ({ ok: true } as const) : ({ ok: false, message: result.message } as const);
}
