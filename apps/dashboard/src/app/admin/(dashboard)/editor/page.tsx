import { RiLayoutMasonryLine } from "@remixicon/react";
import {
  getStorefrontEditorManifest,
  getStorefrontTemplateDefinition,
} from "@ecs/storefront-templates";
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
  EmptyTitle,
} from "@/components/ui/empty";
import { StorefrontVisualEditor } from "@/features/storefront-editor/storefront-visual-editor";
import { type DashboardSearchParams, getSelectedTenantId } from "@/lib/dashboard-tenant-context";
import { getMerchantDashboardAccessShell } from "@/lib/merchant-dashboard";
import { mapPlatformErrorMessage } from "@/lib/platform-api/errors";
import {
  buildStorefrontPreviewUrl,
  resolvePublicStorefrontProtocol,
} from "@/lib/storefront-preview-url";
import {
  getStorefrontDraft,
  createStorefrontPreviewSession,
  publishStorefrontDraft,
  unpublishStorefront,
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
  const storefrontProtocol = resolvePublicStorefrontProtocol({
    configuredProtocol: process.env.STOREFRONT_PUBLIC_PROTOCOL,
    forwardedProtocol: requestHeaders.get("x-forwarded-proto"),
    hostname: requestHeaders.get("host")?.split(":", 1)[0] ?? "localhost",
    nodeEnv: process.env.NODE_ENV,
  });
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
  const editorManifest = draft?.ok
    ? getStorefrontEditorManifest(draft.draft.templateKey)
    : undefined;
  const previewSession =
    draft?.ok && editorManifest?.previewMode === "iframe"
      ? await createStorefrontPreviewSession({
          cookieHeader: requestHeaders.get("cookie"),
          platformApiBaseUrl,
          tenantId: draft.draft.tenantId,
        })
      : null;

  return (
    <PageShell
      className="gap-0 p-0"
      description={t("editor.description")}
      hideHeader
      title={t("editor.title")}
      viewportWorkspace
    >
      {!access.ok ? (
        <Alert variant="destructive">
          <AlertTitle>{t("editor.error.loadTitle")}</AlertTitle>
          <AlertDescription>
            {mapPlatformErrorMessage(access.message, { resource: "Editor" })}
          </AlertDescription>
        </Alert>
      ) : !draft?.ok ? (
        <Empty className="min-h-60 gap-3 rounded-2xl border border-border/80 bg-card/95 p-8 shadow-[0_1px_2px_color-mix(in_oklch,var(--foreground)_4%,transparent)] sm:min-h-72">
          <EmptyHeader className="gap-2.5">
            <span className="text-muted-foreground/80">
              <RiLayoutMasonryLine className="size-5" aria-hidden />
            </span>
            <EmptyTitle className="font-medium">{t("editor.empty.title")}</EmptyTitle>
            <EmptyDescription className="text-sm leading-relaxed">
              {t("editor.empty.description")}
            </EmptyDescription>
          </EmptyHeader>
          <Button asChild size="sm">
            <Link href="/admin/settings?tab=storefront">{t("editor.actions.openSettings")}</Link>
          </Button>
        </Empty>
      ) : (
        <StorefrontVisualEditor
          draft={draft.draft}
          editorMeta={{
            initiallyPublished: access.access.storefront.isPublished,
            liveStorefrontUrl: getLiveStorefrontUrl(
              access.access.domain.hostname,
              storefrontProtocol,
            ),
            previewUrl:
              previewSession?.ok
                ? buildStorefrontPreviewUrl({
                    hostname: access.access.domain.hostname,
                    protocol: storefrontProtocol,
                    token: previewSession.token,
                  })
                : undefined,
            settingsUrl: "/admin/settings?tab=storefront",
            storefrontName: access.access.tenant.name,
            templateKey: draft.draft.templateKey,
            templateName: getTemplateDisplayName(draft.draft.templateKey),
          }}
          onPublish={publishDraftAction}
          onUnpublish={unpublishShopAction}
          onSave={saveDraftAction}
        />
      )}
    </PageShell>
  );
}

function getTemplateDisplayName(templateKey: string) {
  return getStorefrontTemplateDefinition(templateKey)?.name ?? templateKey;
}

function getLiveStorefrontUrl(hostname: string, protocol: "http" | "https") {
  return `${protocol}://${hostname}`;
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

async function unpublishShopAction(tenantId: string) {
  "use server";

  const requestHeaders = await headers();
  const result = await unpublishStorefront({
    cookieHeader: requestHeaders.get("cookie"),
    platformApiBaseUrl: process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000",
    tenantId,
  });

  return result.ok ? ({ ok: true } as const) : ({ ok: false, message: result.message } as const);
}
