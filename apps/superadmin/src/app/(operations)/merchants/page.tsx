import { headers } from "next/headers";

import { OperatorReadError } from "@/components/operator-read-error";
import { MerchantDirectory } from "@/features/superadmin/merchant-directory";
import { listSuperadminTenants } from "@/lib/platform-api/superadmin/tenants";

export default async function MerchantsPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; page?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const q = params.q?.trim().slice(0, 100) ?? "";
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const limit = 20;
  const requestHeaders = await headers();
  const result = await listSuperadminTenants({
    cookieHeader: requestHeaders.get("cookie"),
    limit,
    offset: (page - 1) * limit,
    ...(process.env.PLATFORM_API_BASE_URL
      ? { platformApiBaseUrl: process.env.PLATFORM_API_BASE_URL }
      : {}),
    query: q,
  });

  return (
    <div className="space-y-7">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Directory</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em]">Merchants</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Find a merchant and open the operational context needed to help them.
        </p>
      </header>

      {!result.ok ? (
        <OperatorReadError
          resource="Merchant directory"
          status={result.status}
          unavailableDescription="Merchants could not be loaded. Your current search has been preserved."
        />
      ) : (
        <MerchantDirectory initialData={result.data} initialPage={page} initialQuery={q} />
      )}
    </div>
  );
}
