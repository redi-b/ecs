import { headers } from "next/headers";
import { OperationsPageHeader } from "@/components/operations-page-header";
import { OperatorReadError } from "@/components/operator-read-error";
import { StorefrontTemplateWorkspace } from "@/features/superadmin/storefront-template-workspace";
import { getOperatorStorefrontTemplates } from "@/lib/platform-api/superadmin/storefront-templates";

export default async function StorefrontTemplatesPage() {
  const requestHeaders = await headers();
  const result = await getOperatorStorefrontTemplates({
    cookieHeader: requestHeaders.get("cookie"),
    ...(process.env.PLATFORM_API_BASE_URL
      ? { platformApiBaseUrl: process.env.PLATFORM_API_BASE_URL }
      : {}),
  }).catch(() => ({
    message: "storefront_templates_unavailable",
    ok: false as const,
    status: 503,
  }));

  return (
    <div className="flex flex-col gap-6">
      <OperationsPageHeader
        title="Templates"
        description="Manage storefront previews and public demos."
      />
      {!result.ok ? (
        <OperatorReadError
          resource="Storefront templates"
          status={result.status}
          unavailableDescription="Template presentation details could not be loaded."
        />
      ) : (
        <StorefrontTemplateWorkspace catalog={result.data} />
      )}
    </div>
  );
}
