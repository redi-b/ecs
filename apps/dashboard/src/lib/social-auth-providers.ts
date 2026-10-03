export type SocialAuthProviders = {
  google: boolean;
  telegram: boolean;
};

export async function getSocialAuthProviders(platformApiBaseUrl: string) {
  const baseUrl = platformApiBaseUrl.replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/platform/auth/providers`, {
    cache: "no-store",
    headers: { accept: "application/json" },
  }).catch(() => null);

  if (!response?.ok) return { google: false, telegram: false } satisfies SocialAuthProviders;

  const body = (await response.json().catch(() => null)) as {
    google?: unknown;
    telegram?: unknown;
  } | null;
  return {
    google: body?.google === true,
    telegram: body?.telegram === true,
  } satisfies SocialAuthProviders;
}
