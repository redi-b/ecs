import { headers } from "next/headers";

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
    <div className="flex flex-col gap-7">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Billing</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em]">Plans</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Prepare commercial terms, review their impact, and publish immutable plan versions.
        </p>
      </header>
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
