import { headers } from "next/headers";
import { OperationsPageHeader } from "@/components/operations-page-header";
import { OperatorReadError } from "@/components/operator-read-error";
import { PlanCatalogWorkspace } from "@/features/superadmin/plan-catalog-workspace";
import { getOperatorPlanCatalog } from "@/lib/platform-api/superadmin/billing";

export default async function PlansPage() {
  const requestHeaders = await headers();
  const result = await getOperatorPlanCatalog({
    cookieHeader: requestHeaders.get("cookie"),
    ...(process.env.PLATFORM_API_BASE_URL
      ? { platformApiBaseUrl: process.env.PLATFORM_API_BASE_URL }
      : {}),
  }).catch(() => ({ ok: false as const, message: "billing_plans_unavailable", status: 503 }));

  return (
    <div className="flex flex-col gap-6">
      <OperationsPageHeader
        title="Plans"
        description="Review published terms and prepare plan changes."
      />
      {!result.ok ? (
        <OperatorReadError
          resource="Billing plans"
          status={result.status}
          unavailableDescription="Plans could not be loaded. No commercial terms were changed."
        />
      ) : (
        <PlanCatalogWorkspace catalog={result.data} />
      )}
    </div>
  );
}
