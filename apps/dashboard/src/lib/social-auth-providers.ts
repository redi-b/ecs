export type SocialAuthProviders = {
  google: boolean;
};

export async function getSocialAuthProviders(platformApiBaseUrl: string) {
  const baseUrl = platformApiBaseUrl.replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/platform/auth/providers`, {
    cache: "no-store",
    headers: { accept: "application/json" },
  }).catch(() => null);

  if (!response?.ok) return { google: false } satisfies SocialAuthProviders;

  const body = (await response.json().catch(() => null)) as { google?: unknown } | null;
  return { google: body?.google === true } satisfies SocialAuthProviders;
}
