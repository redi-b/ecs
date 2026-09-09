import { headers } from "next/headers";

import { OperatorReadError } from "@/components/operator-read-error";
import { StorefrontTemplateWorkspace } from "@/features/superadmin/storefront-template-workspace";
import { getOperatorStorefrontTemplates } from "@/lib/platform-api/superadmin/storefront-templates";

export default async function StorefrontTemplatesPage() {
  const requestHeaders = await headers();
  const result = await getOperatorStorefrontTemplates({
    cookieHeader: requestHeaders.get("cookie"),
    ...(process.env.PLATFORM_API_BASE_URL ? { platformApiBaseUrl: process.env.PLATFORM_API_BASE_URL } : {}),
  }).catch(() => ({ message: "storefront_templates_unavailable", ok: false as const, status: 503 }));

  return (
    <div className="flex flex-col gap-7">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Storefront</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em]">Templates</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Manage the preview and public demo shown when merchants choose a storefront.
        </p>
      </header>
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
