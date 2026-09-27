import type { APIRoute } from "astro";
import { getDashboardUrls, getPlatformApiUrl } from "../../lib/platform";

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const cookie = request.headers.get("cookie");
  let authenticated = false;

  if (cookie) {
    try {
      const response = await fetch(`${getPlatformApiUrl()}/platform/me`, {
        headers: { accept: "application/json", cookie },
        signal: AbortSignal.timeout(2_500),
      });
      authenticated = response.ok;
    } catch {
      authenticated = false;
    }
  }

  return Response.json(
    {
      authenticated,
      dashboardUrl: getDashboardUrls().dashboard,
      sessionProbeUrl: `${process.env.PUBLIC_PLATFORM_API_URL || "http://api.lvh.me"}/platform/me`,
    },
    { headers: { "cache-control": "private, no-store" } },
  );
};
