export function getPlatformApiBaseUrl() {
  return process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000";
}

export function getEcsLandingPageUrl(environment: NodeJS.ProcessEnv = process.env) {
  const configured = environment.ECS_LANDING_PAGE_URL?.trim();
  if (configured) return configured;
  if (environment.NODE_ENV !== "production") return "http://ecs.lvh.me";
  throw new Error("ECS_LANDING_PAGE_URL is required in production");
}

function configuredValue(value: string | undefined) {
  const normalized = value?.trim();
  return normalized || undefined;
}

export function getStorefrontDemoHost(
  buildTimeValue?: string,
  environment: NodeJS.ProcessEnv = process.env,
) {
  return configuredValue(environment.STOREFRONT_DEMO_HOST) ?? configuredValue(buildTimeValue);
}

export function getStorefrontBaseDomain({
  buildBaseDomain,
  buildPublicBaseDomain,
  environment = process.env,
}: {
  buildBaseDomain?: string;
  buildPublicBaseDomain?: string;
  environment?: NodeJS.ProcessEnv;
}) {
  return (
    configuredValue(environment.STOREFRONT_BASE_DOMAIN) ??
    configuredValue(environment.STOREFRONT_PUBLIC_BASE_DOMAIN) ??
    configuredValue(buildBaseDomain) ??
    configuredValue(buildPublicBaseDomain) ??
    "lvh.me"
  );
}

export function getRequestHost(request: Request) {
  return request.headers.get("x-forwarded-host") ?? request.headers.get("host");
}
