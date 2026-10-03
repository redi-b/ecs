import { type PlatformRequestContext, platformFetch } from "@/lib/platform-api/client";

export type OperatorDiscoveryCampaign = {
  id: string;
  key: string;
  status: string;
  priority: number;
  startsAt: string | null;
  endsAt: string | null;
  cooldownHours: number;
  snoozeDays: number;
  maxImpressions: number | null;
  content: unknown;
  action: unknown;
  targeting: unknown;
};

export async function getOperatorDiscoveryCampaigns(options: PlatformRequestContext) {
  const response = await platformFetch("/platform/operator/discovery/campaigns", options);
  const data = (await response.json().catch(() => ({}))) as { campaigns?: unknown };
  if (!response.ok || !Array.isArray(data.campaigns)) {
    return { ok: false as const, status: response.status || 503, campaigns: [] };
  }
  return {
    ok: true as const,
    status: response.status,
    campaigns: data.campaigns.filter(isCampaign),
  };
}

export async function updateOperatorDiscoveryCampaign(
  options: PlatformRequestContext & {
    campaignId: string;
    patch: Record<string, unknown>;
    reason: string;
  },
) {
  const response = await platformFetch(
    `/platform/operator/discovery/campaigns/${encodeURIComponent(options.campaignId)}`,
    {
      ...options,
      body: JSON.stringify({ patch: options.patch, reason: options.reason }),
      contentType: "json",
      method: "POST",
    },
  );
  return { status: response.status, data: await response.json().catch(() => ({})) };
}

function isCampaign(value: unknown): value is OperatorDiscoveryCampaign {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    typeof row.key === "string" &&
    typeof row.status === "string" &&
    typeof row.priority === "number"
  );
}
