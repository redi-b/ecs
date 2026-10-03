import { headers } from "next/headers";
import { OperationsPageHeader } from "@/components/operations-page-header";
import { OperatorReadError } from "@/components/operator-read-error";
import { DiscoveryCampaignWorkspace } from "@/features/superadmin/discovery-campaign-workspace";
import { getOperatorDiscoveryCampaigns } from "@/lib/platform-api/superadmin/discovery";

export default async function DiscoveryPage() {
  const requestHeaders = await headers();
  const result = await getOperatorDiscoveryCampaigns({
    cookieHeader: requestHeaders.get("cookie"),
    ...(process.env.PLATFORM_API_BASE_URL
      ? { platformApiBaseUrl: process.env.PLATFORM_API_BASE_URL }
      : {}),
  }).catch(() => ({ ok: false as const, status: 503, campaigns: [] }));

  return (
    <div className="flex flex-col gap-6">
      <OperationsPageHeader
        title="Discovery"
        description="Control dashboard discovery campaigns and their delivery windows."
      />
      {!result.ok ? (
        <OperatorReadError
          resource="Discovery campaigns"
          status={result.status}
          unavailableDescription="Discovery campaigns could not be loaded."
        />
      ) : (
        <DiscoveryCampaignWorkspace campaigns={result.campaigns} />
      )}
    </div>
  );
}
