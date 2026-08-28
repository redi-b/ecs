import type { APIRoute } from "astro";

import { loadPageContext } from "../lib/page-context.js";
import { buildTenantRobots } from "../lib/seo-routes.js";

export const GET: APIRoute = async ({ request }) => {
  const context = await loadPageContext(request, { skipCart: true });
  if (!context.ok) {
    return new Response("User-agent: *\nDisallow: /\n", {
      status: context.status,
      headers: seoTextHeaders("text/plain; charset=utf-8", "no-store"),
    });
  }
  return new Response(buildTenantRobots(context.publicOrigin), {
    headers: seoTextHeaders("text/plain; charset=utf-8", "public, max-age=300"),
  });
};

function seoTextHeaders(contentType: string, cacheControl: string) {
  return {
    "Cache-Control": cacheControl,
    "Content-Type": contentType,
    Vary: "Host, X-Forwarded-Host",
  };
}
