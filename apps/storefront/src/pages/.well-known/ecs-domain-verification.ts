import type { APIRoute } from "astro";
import { getDomainProbeResponse } from "../../lib/domain-probe.js";
import { getPlatformApiBaseUrl } from "../../lib/env.js";

export const prerender = false;
export const GET: APIRoute = ({ request }) =>
  getDomainProbeResponse({ request, platformApiBaseUrl: getPlatformApiBaseUrl() });
