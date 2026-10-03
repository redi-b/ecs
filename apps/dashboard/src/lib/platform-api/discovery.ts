import { type PlatformRequestContext, platformFetch } from "./client";

export type DiscoveryCampaignPayload = {
  id: string;
  key: string;
  content: Record<string, { eyebrow: string; title: string; description: string; action: string }>;
  action: { href: string; icon: string };
};

export async function getPlatformDiscoveryCampaigns(
  options: PlatformRequestContext & { setupComplete: boolean },
) {
  const response = await platformFetch("/platform/merchant/discovery", {
    contentType: "json",
    cookieHeader: options.cookieHeader,
    platformApiBaseUrl: options.platformApiBaseUrl,
    requestHost: options.requestHost,
    searchParams: { setupComplete: options.setupComplete ? "true" : "false" },
  }).catch(() => null);
  if (!response?.ok) return [] satisfies DiscoveryCampaignPayload[];
  const data = (await response.json().catch(() => null)) as { campaigns?: unknown } | null;
  if (!Array.isArray(data?.campaigns)) return [];
  return data.campaigns.filter(isCampaign) as DiscoveryCampaignPayload[];
}

function isCampaign(value: unknown): value is DiscoveryCampaignPayload {
  if (!value || typeof value !== "object") return false;
  const campaign = value as Record<string, unknown>;
  return (
    typeof campaign.id === "string" &&
    typeof campaign.key === "string" &&
    typeof campaign.content === "object" &&
    typeof campaign.action === "object"
  );
}
