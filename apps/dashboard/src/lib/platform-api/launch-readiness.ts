import { type LaunchReadiness, launchReadinessSchema } from "@ecs/contracts";
import { type PlatformRequestContext, platformFetch } from "./client";

export async function getPlatformLaunchReadiness(
  options: PlatformRequestContext & {
    fetcher?: typeof fetch;
    tenantId: string;
  },
): Promise<LaunchReadiness | null> {
  const response = await platformFetch(
    `/platform/tenants/${encodeURIComponent(options.tenantId)}/launch-readiness`,
    {
      contentType: "json",
      cookieHeader: options.cookieHeader,
      platformApiBaseUrl: options.platformApiBaseUrl,
      requestHost: options.requestHost,
      ...(options.fetcher ? { fetcher: options.fetcher } : {}),
    },
  ).catch(() => null);

  if (!response || !response.ok) {
    return null;
  }

  const data = (await response.json().catch(() => null)) as unknown;
  const payload =
    data && typeof data === "object" && "readiness" in data
      ? (data as { readiness?: unknown }).readiness
      : undefined;

  const parsed = launchReadinessSchema.safeParse(payload);
  return parsed.success ? parsed.data : null;
}
